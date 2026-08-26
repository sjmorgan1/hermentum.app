import { registerPlugin } from "@capacitor/core";

// ─────────────────────────────────────────────────────────────────────────────
// HealthKit Capacitor plugin definition (web/TS side).
//
// The native implementation lives in ios/App/App/HealthKitPlugin.swift.
// When running outside a native iOS app (browser/dev), registerPlugin returns
// a proxy whose calls reject with "not available" — we handle that gracefully
// in HealthDataService.
// ─────────────────────────────────────────────────────────────────────────────

export interface HealthKitRecord {
  externalId: string;
  activityType: string;      // workout | walk | run | cycle | sleep
  startTime: string;         // ISO 8601
  endTime: string;            // ISO 8601
  durationMinutes: number;
  sourceName: string | null;
  sourceBundleIdentifier: string | null;
  // Additional metadata for audit (steps, distance_km) — kept minimal.
  metadata: Record<string, unknown>;
}

export interface HealthKitAuthorizationResult {
  granted: boolean;
  // If the user denied access, HealthKit reports "notDetermined" for privacy
  // reasons; we surface what we can.
  status: "granted" | "denied" | "unknown";
}

export interface HealthKitAvailabilityResult {
  available: boolean;
}

export interface HealthKitFetchOptions {
  since: string;             // ISO 8601 — fetch records after this date
  limit?: number;
}

export interface HealthKitFetchResult {
  records: HealthKitRecord[];
}

export interface HealthKitPlugin {
  isAvailable(): Promise<HealthKitAvailabilityResult>;
  requestAuthorization(): Promise<HealthKitAuthorizationResult>;
  getAuthorizationStatus(): Promise<HealthKitAuthorizationResult>;
  fetchWorkouts(options: HealthKitFetchOptions): Promise<HealthKitFetchResult>;
  fetchSteps(options: HealthKitFetchOptions): Promise<HealthKitFetchResult>;
  fetchDistanceWalkingRunning(options: HealthKitFetchOptions): Promise<HealthKitFetchResult>;
  fetchDistanceCycling(options: HealthKitFetchOptions): Promise<HealthKitFetchResult>;
  fetchSleep(options: HealthKitFetchOptions): Promise<HealthKitFetchResult>;
}

export const HealthKit = registerPlugin<HealthKitPlugin>("HealthKit");
