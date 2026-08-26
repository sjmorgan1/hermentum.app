import { Capacitor } from "@capacitor/core";
import { HealthKit, type HealthKitRecord } from "../plugins/healthkit-plugin";
import type { PermissionState, AutoEventType, AutomaticEvent } from "./datasource";

// ─────────────────────────────────────────────────────────────────────────────
// HealthDataService — clean abstraction over the native HealthKit bridge.
//
// When running as a native iOS app (Capacitor), it talks to the real
// HealthKit plugin. When running in a browser or unsupported device, every
// method reports unavailable gracefully — no fake data, no fake connection.
//
// All methods are async and never throw on "unavailable"; they return a
// clearly-typed unavailable result instead.
// ─────────────────────────────────────────────────────────────────────────────

export type HealthPermissionState = PermissionState;

export interface HealthRecord {
  externalId: string;
  activityType: AutoEventType;
  startTime: string;       // ISO 8601
  endTime: string;          // ISO 8601
  durationMinutes: number;
  sourceName: string | null;
  sourceBundleIdentifier: string | null;
  metadata: Record<string, unknown>;
}

export interface HealthSyncResult {
  newRecords: HealthRecord[];
  skippedDuplicates: number;
  unavailable: boolean;
  error?: string;
}

export interface HealthAvailability {
  available: boolean;
  reason?: "not_native" | "no_healthkit" | "plugin_missing";
}

class HealthDataService {
  private cachedAvailability: HealthAvailability | null = null;

  /** Whether the native HealthKit bridge can run in this environment. */
  async checkAvailability(): Promise<HealthAvailability> {
    if (this.cachedAvailability) return this.cachedAvailability;

    if (!Capacitor.isNativePlatform()) {
      this.cachedAvailability = { available: false, reason: "not_native" };
      return this.cachedAvailability;
    }

    if (Capacitor.getPlatform() !== "ios") {
      this.cachedAvailability = { available: false, reason: "no_healthkit" };
      return this.cachedAvailability;
    }

    try {
      const result = await HealthKit.isAvailable();
      if (!result.available) {
        this.cachedAvailability = { available: false, reason: "no_healthkit" };
      } else {
        this.cachedAvailability = { available: true };
      }
    } catch {
      this.cachedAvailability = { available: false, reason: "plugin_missing" };
    }
    return this.cachedAvailability;
  }

  /** Request READ-only authorization for the five supported types. */
  async requestHealthPermissions(): Promise<HealthPermissionState> {
    const avail = await this.checkAvailability();
    if (!avail.available) return "unavailable";

    try {
      const result = await HealthKit.requestAuthorization();
      if (result.granted) return "granted";
      // HealthKit may return success=false if the user denied the sheet.
      return result.status === "denied" ? "denied" : "unknown";
    } catch {
      return "denied";
    }
  }

  /** Check the current authorization status without prompting. */
  async getAuthorizationStatus(): Promise<HealthPermissionState> {
    const avail = await this.checkAvailability();
    if (!avail.available) return "unavailable";

    try {
      const result = await HealthKit.getAuthorizationStatus();
      if (result.granted) return "granted";
      return result.status === "denied" ? "denied" : "unknown";
    } catch {
      return "unknown";
    }
  }

  /** Connect: check availability + request permissions in one flow. */
  async connectHealth(): Promise<HealthPermissionState> {
    const avail = await this.checkAvailability();
    if (!avail.available) return "unavailable";
    return this.requestHealthPermissions();
  }

  /** Disconnect — HealthKit has no explicit revoke; we clear our sync state. */
  async disconnectHealth(): Promise<void> {
    // The actual disconnection is handled at the app layer (connected_accounts).
    // HealthKit permissions persist at the OS level; we simply stop syncing.
  }

  /** Fetch recent workouts since the given date. */
  async getRecentWorkouts(since: Date): Promise<HealthRecord[]> {
    return this.fetchSafe(() => HealthKit.fetchWorkouts({ since: since.toISOString() }));
  }

  /** Fetch recent steps (aggregated into walks) since the given date. */
  async getRecentActivity(since: Date): Promise<HealthRecord[]> {
    const [steps, walkRun, cycle] = await Promise.all([
      this.fetchSafe(() => HealthKit.fetchSteps({ since: since.toISOString() })),
      this.fetchSafe(() => HealthKit.fetchDistanceWalkingRunning({ since: since.toISOString() })),
      this.fetchSafe(() => HealthKit.fetchDistanceCycling({ since: since.toISOString() })),
    ]);
    // Merge and dedupe by externalId — a workout and distance sample may
    // describe the same activity. Prefer the workout record.
    const byId = new Map<string, HealthRecord>();
    for (const r of [...walkRun, ...cycle, ...steps]) {
      if (!byId.has(r.externalId)) byId.set(r.externalId, r);
    }
    return Array.from(byId.values());
  }

  /** Fetch recent sleep records since the given date. */
  async getRecentSleep(since: Date): Promise<HealthRecord[]> {
    return this.fetchSafe(() => HealthKit.fetchSleep({ since: since.toISOString() }));
  }

  /** Fetch all new health data since a date (workouts + activity + sleep). */
  async getNewHealthData(since: Date): Promise<HealthRecord[]> {
    const [workouts, activity, sleep] = await Promise.all([
      this.getRecentWorkouts(since),
      this.getRecentActivity(since),
      this.getRecentSleep(since),
    ]);

    // Deduplicate across sources by externalId. Workouts take priority,
    // then distance-based activity, then steps.
    const byId = new Map<string, HealthRecord>();
    for (const r of activity) byId.set(r.externalId, r);
    for (const r of sleep) byId.set(r.externalId, r);
    for (const r of workouts) byId.set(r.externalId, r); // workouts win

    return Array.from(byId.values()).sort(
      (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );
  }

  private async fetchSafe(fn: () => Promise<{ records: HealthKitRecord[] }>): Promise<HealthRecord[]> {
    const avail = await this.checkAvailability();
    if (!avail.available) return [];
    try {
      const result = await fn();
      return result.records.map(mapRecord);
    } catch {
      return [];
    }
  }
}

function mapRecord(r: HealthKitRecord): HealthRecord {
  return {
    externalId: r.externalId,
    activityType: r.activityType as AutoEventType,
    startTime: r.startTime,
    endTime: r.endTime,
    durationMinutes: r.durationMinutes,
    sourceName: r.sourceName,
    sourceBundleIdentifier: r.sourceBundleIdentifier,
    metadata: r.metadata,
  };
}

/** Convert a HealthRecord into the app's AutomaticEvent shape. */
export function healthRecordToEvent(r: HealthRecord): AutomaticEvent {
  return {
    source: "healthkit",
    source_type: r.activityType,
    timestamp: r.startTime,
    duration_minutes: r.durationMinutes,
    metadata: {
      ...r.metadata,
      external_id: r.externalId,
      activity_type: r.activityType,
      start_time: r.startTime,
      end_time: r.endTime,
      source_name: r.sourceName,
      source_bundle_identifier: r.sourceBundleIdentifier,
    },
    confidence: "high",
  };
}

export const healthDataService = new HealthDataService();
