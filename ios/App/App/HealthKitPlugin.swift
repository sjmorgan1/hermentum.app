import Foundation
import Capacitor
import HealthKit

// ─────────────────────────────────────────────────────────────────────────────
// HealthKitPlugin — native iOS bridge between Hermentum's web layer and Apple
// HealthKit. READ access only. Never requests write permissions.
//
// Data types requested for read:
//   - HKWorkoutType
//   - Step count
//   - Walking + running distance
//   - Cycling distance
//   - Sleep analysis
//
// Every record returned carries a stable externalId derived from the HealthKit
// object UUID so the web layer can deduplicate across repeated syncs.
// ─────────────────────────────────────────────────────────────────────────────

@objc(HealthKitPlugin)
public class HealthKitPlugin: CAPPlugin {

    private let healthStore = HKHealthStore()

    // ─── Availability ───────────────────────────────────────────────────────

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve([
            "available": HKHealthStore.isHealthDataAvailable()
        ])
    }

    // ─── Authorization ──────────────────────────────────────────────────────

    private func readTypes() -> Set<HKObjectType> {
        return Set([
            HKObjectType.workoutType(),
            HKQuantityType.quantityType(forIdentifier: .stepCount)!,
            HKQuantityType.quantityType(forIdentifier: .distanceWalkingRunning)!,
            HKQuantityType.quantityType(forIdentifier: .distanceCycling)!,
            HKCategoryType.categoryType(forIdentifier: .sleepAnalysis)!
        ])
    }

    @objc func requestAuthorization(_ call: CAPPluginCall) {
        healthStore.requestAuthorization(toShare: [], read: readTypes()) { success, error in
            if let error = error {
                call.reject("HealthKit authorization error: \(error.localizedDescription)")
                return
            }
            // HealthKit never tells us *which* types were granted for privacy reasons.
            // success == true means the sheet completed; the user may still have denied
            // individual types. We treat success as "granted" but the web layer must
            // verify by attempting to fetch.
            call.resolve([
                "granted": success,
                "status": success ? "granted" : "denied"
            ])
        }
    }

    @objc func getAuthorizationStatus(_ call: CAPPluginCall) {
        // For each read type, check the authorization status. HealthKit only reports
        // sharing (write) status accurately; for reading it returns .sharingAuthorized
        // if the user has been prompted, or .sharingNotDetermined if never prompted.
        var anyAuthorized = false
        var anyDenied = false
        for type in readTypes() {
            let status = healthStore.authorizationStatus(for: type)
            if status == .sharingAuthorized {
                anyAuthorized = true
            }
            if status == .sharingDenied {
                anyDenied = true
            }
        }
        let status: String
        if anyAuthorized {
            status = "granted"
        } else if anyDenied {
            status = "denied"
        } else {
            status = "unknown"
        }
        call.resolve([
            "granted": anyAuthorized,
            "status": status
        ])
    }

    // ─── Fetch: Workouts ────────────────────────────────────────────────────

    @objc func fetchWorkouts(_ call: CAPPluginCall) {
        let since = parseDate(call.getString("since") ?? "")
        let limit = call.getInt("limit") ?? Int(HKObjectQueryNoLimit)

        let predicate = HKQuery.predicateForSamples(withStart: since, end: nil, options: .strictStartDate)
        let sort = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)

        let query = HKSampleQuery(sampleType: HKObjectType.workoutType(),
                                  predicate: predicate,
                                  limit: limit,
                                  sortDescriptors: [sort]) { _, results, error in
            if let error = error {
                call.reject("Workout fetch error: \(error.localizedDescription)")
                return
            }
            guard let workouts = results as? [HKWorkout] else {
                call.resolve(["records": []])
                return
            }
            let records = workouts.map { self.workoutToRecord($0) }
            call.resolve(["records": records])
        }
        healthStore.execute(query)
    }

    // ─── Fetch: Steps ───────────────────────────────────────────────────────

    @objc func fetchSteps(_ call: CAPPluginCall) {
        let since = parseDate(call.getString("since") ?? "")
        let limit = call.getInt("limit") ?? Int(HKObjectQueryNoLimit)

        guard let stepType = HKQuantityType.quantityType(forIdentifier: .stepCount) else {
            call.resolve(["records": []])
            return
        }

        let predicate = HKQuery.predicateForSamples(withStart: since, end: nil, options: .strictStartDate)
        let sort = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)

        let query = HKSampleQuery(sampleType: stepType,
                                  predicate: predicate,
                                  limit: limit,
                                  sortDescriptors: [sort]) { _, results, error in
            if let error = error {
                call.reject("Steps fetch error: \(error.localizedDescription)")
                return
            }
            guard let samples = results as? [HKQuantitySample] else {
                call.resolve(["records": []])
                return
            }
            // Aggregate steps per contiguous time block — HealthKit stores many
            // short samples. We group by hour to produce a "walk" record.
            let records = self.aggregateStepSamples(samples)
            call.resolve(["records": records])
        }
        healthStore.execute(query)
    }

    // ─── Fetch: Walking/Running Distance ───────────────────────────────────

    @objc func fetchDistanceWalkingRunning(_ call: CAPPluginCall) {
        fetchDistanceSample(call, identifier: .distanceWalkingRunning, activityType: "walk")
    }

    // ─── Fetch: Cycling Distance ───────────────────────────────────────────

    @objc func fetchDistanceCycling(_ call: CAPPluginCall) {
        fetchDistanceSample(call, identifier: .distanceCycling, activityType: "cycle")
    }

    private func fetchDistanceSample(_ call: CAPPluginCall, identifier: HKQuantityTypeIdentifier, activityType: String) {
        let since = parseDate(call.getString("since") ?? "")
        let limit = call.getInt("limit") ?? Int(HKObjectQueryNoLimit)

        guard let type = HKQuantityType.quantityType(forIdentifier: identifier) else {
            call.resolve(["records": []])
            return
        }

        let predicate = HKQuery.predicateForSamples(withStart: since, end: nil, options: .strictStartDate)
        let sort = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)

        let query = HKSampleQuery(sampleType: type,
                                  predicate: predicate,
                                  limit: limit,
                                  sortDescriptors: [sort]) { _, results, error in
            if let error = error {
                call.reject("Distance fetch error: \(error.localizedDescription)")
                return
            }
            guard let samples = results as? [HKQuantitySample] else {
                call.resolve(["records": []])
                return
            }
            let records = self.aggregateDistanceSamples(samples, activityType: activityType)
            call.resolve(["records": records])
        }
        healthStore.execute(query)
    }

    // ─── Fetch: Sleep ───────────────────────────────────────────────────────

    @objc func fetchSleep(_ call: CAPPluginCall) {
        let since = parseDate(call.getString("since") ?? "")
        let limit = call.getInt("limit") ?? Int(HKObjectQueryNoLimit)

        guard let sleepType = HKCategoryType.categoryType(forIdentifier: .sleepAnalysis) else {
            call.resolve(["records": []])
            return
        }

        let predicate = HKQuery.predicateForSamples(withStart: since, end: nil, options: .strictStartDate)
        let sort = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)

        let query = HKSampleQuery(sampleType: sleepType,
                                  predicate: predicate,
                                  limit: limit,
                                  sortDescriptors: [sort]) { _, results, error in
            if let error = error {
                call.reject("Sleep fetch error: \(error.localizedDescription)")
                return
            }
            guard let samples = results as? [HKCategorySample] else {
                call.resolve(["records": []])
                return
            }
            let records = self.aggregateSleepSamples(samples)
            call.resolve(["records": records])
        }
        healthStore.execute(query)
    }

    // ─── Conversion helpers ─────────────────────────────────────────────────

    private func workoutToRecord(_ workout: HKWorkout) -> [String: Any] {
        let activityType = mapWorkoutType(workout.workoutActivityType)
        let durationMinutes = Int(workout.duration / 60)
        let sourceName = workout.sourceRevision.source.name
        let sourceBundle = workout.sourceRevision.source.bundleIdentifier

        var metadata: [String: Any] = [:]
        if let totalDistance = workout.totalDistance?.doubleValue(for: .meter()) {
            metadata["distance_km"] = totalDistance / 1000
        }
        if let totalEnergy = workout.totalEnergyBurned?.doubleValue(for: .kilocalorie()) {
            metadata["energy_kcal"] = totalEnergy
        }

        return [
            "externalId": workout.uuid.uuidString,
            "activityType": activityType,
            "startTime": isoString(workout.startDate),
            "endTime": isoString(workout.endDate),
            "durationMinutes": durationMinutes,
            "sourceName": sourceName,
            "sourceBundleIdentifier": sourceBundle ?? "",
            "metadata": metadata
        ]
    }

    private func aggregateStepSamples(_ samples: [HKQuantitySample]) -> [[String: Any]] {
        // Group step samples by hour, sum counts, produce a "walk" record when
        // the total is meaningful (>= 1000 steps ≈ a real walk).
        let calendar = Calendar.current
        var grouped: [Date: [(Date, Int)]] = [:]

        for s in samples {
            let hour = calendar.dateInterval(of: .hour, for: s.startDate)?.start ?? s.startDate
            let steps = Int(s.quantity.doubleValue(for: .count()))
            grouped[hour, default: []].append((s.startDate, steps))
        }

        var records: [[String: Any]] = []
        for (hour, entries) in grouped {
            let totalSteps = entries.reduce(0) { $0 + $1.1 }
            guard totalSteps >= 1000 else { continue }
            let earliest = entries.min(by: { $0.0 < $1.0 })?.0 ?? hour
            let latest = entries.max(by: { $0.0 < $1.0 })?.0 ?? hour
            let durationMin = max(1, Int(latest.timeIntervalSince(earliest) / 60))
            let firstSource = samples.first { calendar.dateInterval(of: .hour, for: $0.startDate)?.start == hour }

            records.append([
                "externalId": "steps-\(isoString(hour))",
                "activityType": "walk",
                "startTime": isoString(earliest),
                "endTime": isoString(latest),
                "durationMinutes": durationMin,
                "sourceName": firstSource?.sourceRevision.source.name ?? "iPhone",
                "sourceBundleIdentifier": firstSource?.sourceRevision.source.bundleIdentifier ?? "",
                "metadata": ["steps": totalSteps]
            ])
        }
        return records
    }

    private func aggregateDistanceSamples(_ samples: [HKQuantitySample], activityType: String) -> [[String: Any]] {
        // Group distance samples by hour, sum distance, produce a record.
        let calendar = Calendar.current
        var grouped: [Date: [(Date, Double)]] = [:]

        for s in samples {
            let hour = calendar.dateInterval(of: .hour, for: s.startDate)?.start ?? s.startDate
            let meters = s.quantity.doubleValue(for: .meter())
            grouped[hour, default: []].append((s.startDate, meters))
        }

        var records: [[String: Any]] = []
        for (hour, entries) in grouped {
            let totalMeters = entries.reduce(0) { $0 + $1.1 }
            guard totalMeters >= 200 else { continue }
            let earliest = entries.min(by: { $0.0 < $1.0 })?.0 ?? hour
            let latest = entries.max(by: { $0.0 < $1.0 })?.0 ?? hour
            let durationMin = max(1, Int(latest.timeIntervalSince(earliest) / 60))
            let firstSource = samples.first { calendar.dateInterval(of: .hour, for: $0.startDate)?.start == hour }

            records.append([
                "externalId": "\(activityType)-\(isoString(hour))",
                "activityType": activityType,
                "startTime": isoString(earliest),
                "endTime": isoString(latest),
                "durationMinutes": durationMin,
                "sourceName": firstSource?.sourceRevision.source.name ?? "iPhone",
                "sourceBundleIdentifier": firstSource?.sourceRevision.source.bundleIdentifier ?? "",
                "metadata": ["distance_km": totalMeters / 1000]
            ])
        }
        return records
    }

    private func aggregateSleepSamples(_ samples: [HKCategorySample]) -> [[String: Any]] {
        // Group sleep samples by night (the start date), sum durations.
        let calendar = Calendar.current
        var grouped: [Date: [(Date, Date)]] = [:]

        for s in samples {
            let night = calendar.dateInterval(of: .day, for: s.startDate)?.start ?? s.startDate
            grouped[night, default: []].append((s.startDate, s.endDate))
        }

        var records: [[String: Any]] = []
        for (night, intervals) in grouped {
            let earliest = intervals.min(by: { $0.0 < $1.0 })?.0 ?? night
            let latest = intervals.max(by: { $0.1 < $1.1 })?.1 ?? earliest
            let durationMin = max(1, Int(latest.timeIntervalSince(earliest) / 60))
            let firstSource = samples.first { calendar.dateInterval(of: .day, for: $0.startDate)?.start == night }

            records.append([
                "externalId": "sleep-\(isoString(night))",
                "activityType": "sleep",
                "startTime": isoString(earliest),
                "endTime": isoString(latest),
                "durationMinutes": durationMin,
                "sourceName": firstSource?.sourceRevision.source.name ?? "iPhone",
                "sourceBundleIdentifier": firstSource?.sourceRevision.source.bundleIdentifier ?? "",
                "metadata": [:]
            ])
        }
        return records
    }

    private func mapWorkoutType(_ type: HKWorkoutActivityType) -> String {
        switch type {
        case .walking:   return "walk"
        case .running:    return "run"
        case .cycling:    return "cycle"
        default:          return "workout"
        }
    }

    private func parseDate(_ s: String) -> Date {
        if s.isEmpty { return Date.distantPast }
        let formatter = ISO8601DateFormatter()
        return formatter.date(from: s) ?? Date.distantPast
    }

    private func isoString(_ d: Date) -> String {
        let formatter = ISO8601DateFormatter()
        return formatter.string(from: d)
    }
}
