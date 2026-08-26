# Hermentum — Apple Health (HealthKit) Integration

This document describes how the real iOS Apple Health integration works and
how to build Hermentum as a native iOS app using Capacitor.

## Architecture

```
Existing Hermentum React app
        ↓
  Capacitor (native runtime)
        ↓
  HealthKitPlugin.swift (native iOS bridge)
        ↓
  Apple Health / Apple Watch data
```

The web layer never talks to HealthKit directly. It goes through:

1. **`src/plugins/healthkit-plugin.ts`** — TypeScript plugin definition
   registered with Capacitor's `registerPlugin()`. When running outside a
   native iOS app, calls reject gracefully and the app shows "Available on
   iPhone".

2. **`src/lib/healthDataService.ts`** — `HealthDataService` abstraction with
   methods: `connectHealth()`, `getAuthorizationStatus()`,
   `requestHealthPermissions()`, `getRecentWorkouts()`, `getRecentActivity()`,
   `getRecentSleep()`, `getNewHealthData()`, `disconnectHealth()`. Returns
   unavailable gracefully in a browser.

3. **`src/lib/healthSync.ts`** — sync engine with deduplication, overlap
   window, and per-user `last_healthkit_sync_at` tracking.

4. **`ios/App/App/HealthKitPlugin.swift`** — native Swift implementation that
   queries HealthKit for workouts, steps, walking/running distance, cycling
   distance, and sleep. READ access only.

## Data types (READ only)

- Workouts (`HKWorkoutType`)
- Steps (`HKQuantityTypeIdentifierStepCount`)
- Walking/running distance (`HKQuantityTypeIdentifierDistanceWalkingRunning`)
- Cycling distance (`HKQuantityTypeIdentifierDistanceCycling`)
- Sleep analysis (`HKCategoryTypeIdentifierSleepAnalysis`)

No write access. No clinical health records. No unrelated health data.

## Deduplication

Each HealthKit record carries a stable `externalId` (the HealthKit object
UUID, or an aggregated key for steps/distance/sleep). The `moments` table has
a partial unique index on `(user_id, source, external_id)` so the same
HealthKit workout can never produce two Hermentum moments — even across
repeated syncs, Apple Watch + iPhone duplicates, or different HealthKit
sources.

## Sync

- On app launch: `syncHealthData()` checks for new records since
  `last_healthkit_sync_at` with a 30-minute overlap window.
- "SYNC NOW" button in the Apple Health settings screen.
- First connect asks the user how much history to import (Today / This week /
  This month; default This week).

## Building as a native iOS app

```bash
# 1. Build the web layer
npm run build

# 2. Add the iOS platform (first time only)
npx cap add ios

# 3. Copy web assets into the native project
npx cap copy ios

# 4. Open in Xcode
npx cap open ios
```

In Xcode:
1. Set the signing team in the App target's Signing & Capabilities tab.
2. Add the HealthKit capability.
3. Build and run on a physical iPhone (HealthKit is not available on the
   simulator).

## Web fallback

When opened in a browser or unsupported device, Apple Health shows as
"Available on iPhone" with no fake connection and no generated workouts. The
manual "I DID IT" and "Tell Hermentum" flows continue working normally.

## Development test mode

A dev-only HealthKit test mode (`src/lib/healthTestMode.ts`) can simulate
workout, walk, run, cycle, and sleep records for testing the sync and
deduplication logic. It is gated behind `import.meta.env.DEV` and a
localStorage flag — never enabled for production users.
