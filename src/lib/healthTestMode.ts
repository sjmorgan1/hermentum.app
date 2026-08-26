import type { HealthRecord } from "./healthDataService";
import type { AutoEventType } from "./datasource";

// ─────────────────────────────────────────────────────────────────────────────
// HealthKit TEST MODE — DEVELOPMENT ONLY.
//
// Generates simulated HealthKit records (workout, walk, run, cycle, sleep) so
// the sync and deduplication logic can be exercised without a real iPhone.
//
// This module is NEVER enabled for production users. It is gated behind
// `import.meta.env.DEV` and a localStorage flag that must be set explicitly.
// All generated records are clearly marked with sourceName = "HealthKit Test Mode".
// ─────────────────────────────────────────────────────────────────────────────

export type TestActivityType = AutoEventType;

export interface TestSimulateOptions {
  type: TestActivityType;
  /** Minutes from now for the start time (default: -60) */
  offsetMinutes?: number;
  /** Duration in minutes (default: 30) */
  durationMinutes?: number;
}

const TEST_FLAG_KEY = "hermentum_dev_healthkit_test";

/** Whether test mode is enabled. Only true in dev AND when the flag is set. */
export function isTestModeEnabled(): boolean {
  if (!import.meta.env.DEV) return false;
  return localStorage.getItem(TEST_FLAG_KEY) === "1";
}

/** Enable test mode (dev only). */
export function enableTestMode(): void {
  if (!import.meta.env.DEV) return;
  localStorage.setItem(TEST_FLAG_KEY, "1");
}

/** Disable test mode. */
export function disableTestMode(): void {
  localStorage.removeItem(TEST_FLAG_KEY);
}

/** Toggle test mode on/off. Returns the new state. */
export function toggleTestMode(): boolean {
  if (isTestModeEnabled()) {
    disableTestMode();
    return false;
  }
  enableTestMode();
  return true;
}

/**
 * Generate a simulated HealthKit record. The externalId is deterministic
 * (based on type + start time) so repeated simulations of the same event
 * are deduplicated correctly.
 */
export function simulateTestRecord(opts: TestSimulateOptions): HealthRecord {
  const offset = opts.offsetMinutes ?? -60;
  const duration = opts.durationMinutes ?? 30;

  const start = new Date();
  start.setMinutes(start.getMinutes() + offset);
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + duration);

  const externalId = `test-${opts.type}-${start.toISOString()}`;

  const metadata: Record<string, unknown> = {};
  if (opts.type === "walk") metadata.steps = 3000 + Math.floor(Math.random() * 2000);
  if (opts.type === "run" || opts.type === "cycle") {
    metadata.distance_km = Math.round((2 + Math.random() * 5) * 100) / 100;
  }

  return {
    externalId,
    activityType: opts.type,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    durationMinutes: duration,
    sourceName: "HealthKit Test Mode",
    sourceBundleIdentifier: "com.hermentum.dev.testmode",
    metadata,
  };
}

/** Generate a batch of varied test records across the last week. */
export function generateTestBatch(): HealthRecord[] {
  const records: HealthRecord[] = [];
  const now = new Date();

  const types: TestActivityType[] = ["walk", "workout", "run", "sleep"];
  for (let d = 0; d < 7; d++) {
    for (const type of types) {
      // Skip some randomly to make it realistic
      if (Math.random() > 0.6 && type !== "sleep") continue;

      const start = new Date(now);
      start.setDate(start.getDate() - d);
      start.setHours(
        type === "sleep" ? 23 : 7 + Math.floor(Math.random() * 12),
        Math.floor(Math.random() * 60),
        0, 0
      );

      const duration =
        type === "sleep" ? (6 + Math.floor(Math.random() * 3)) * 60 :
        type === "workout" ? 30 + Math.floor(Math.random() * 30) :
        type === "run" ? 20 + Math.floor(Math.random() * 20) :
        25 + Math.floor(Math.random() * 20);

      const end = new Date(start);
      end.setMinutes(end.getMinutes() + duration);

      const externalId = `test-${type}-${start.toISOString()}`;
      const metadata: Record<string, unknown> = {};
      if (type === "walk") metadata.steps = 3000 + Math.floor(Math.random() * 2000);
      if (type === "run" || type === "cycle") {
        metadata.distance_km = Math.round((2 + Math.random() * 5) * 100) / 100;
      }

      records.push({
        externalId,
        activityType: type,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        durationMinutes: duration,
        sourceName: "HealthKit Test Mode",
        sourceBundleIdentifier: "com.hermentum.dev.testmode",
        metadata,
      });
    }
  }

  return records.sort(
    (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  );
}
