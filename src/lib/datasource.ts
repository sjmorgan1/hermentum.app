// ─────────────────────────────────────────────────────────────────────────────
// DataSourceAdapter — the abstraction layer for all automatic data sources.
//
// Every source (HealthKit, Health Connect, Calendar, Demo, Manual) implements
// the same interface. The app never knows or cares which adapter it's talking
// to. When Capacitor native plugins are added later, only the adapter
// implementations change — nothing else in the app needs to know.
//
// Architecture:
//
//   DataSourceAdapter (interface)
//     ├── HealthKitAdapter       — iOS, via Capacitor plugin (stub for now)
//     ├── HealthConnectAdapter   — Android, via Capacitor plugin (stub for now)
//     ├── CalendarAdapter        — Cross-platform, via Capacitor plugin (stub)
//     ├── DemoDataAdapter       — Browser/dev only, clearly labelled
//     └── ManualAdapter          — The "I DID IT" flow, always available
//
// Each adapter produces AutomaticEvent objects, which the app converts into
// moments. The event is purely factual — no subjective interpretation.
// ─────────────────────────────────────────────────────────────────────────────

import { healthDataService, healthRecordToEvent } from "./healthDataService";

export type PermissionState = "unknown" | "granted" | "denied" | "unavailable";

export type SourceKey = "healthkit" | "health_connect" | "calendar" | "demo" | "manual";

export type ConfidenceLevel = "high" | "medium" | "low";

// The supported automatic event types.
export type AutoEventType = "workout" | "walk" | "run" | "cycle" | "sleep";

// A single automatic event from a data source. Purely factual.
export interface AutomaticEvent {
  source: SourceKey;
  source_type: AutoEventType;
  timestamp: string;            // ISO 8601
  duration_minutes?: number;    // minutes, if available
  metadata: Record<string, unknown>;
  confidence: ConfidenceLevel;
}

// The interface every data source adapter must implement.
export interface DataSourceAdapter {
  readonly sourceKey: SourceKey;
  readonly displayName: string;
  readonly isDemo: boolean;
  readonly isAvailable: boolean;     // Can this adapter run in the current environment?

  // What Hermentum will use from this source — shown to the user before connecting.
  readonly dataDescription: string;

  checkAvailability(): Promise<boolean>;
  requestPermission(): Promise<PermissionState>;
  getPermissionState(): PermissionState;

  // Fetch automatic events since the given date. Returns empty if not permitted.
  fetchEvents(since: Date): Promise<AutomaticEvent[]>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

export function eventLabel(e: AutomaticEvent): string {
  const dur = e.duration_minutes;
  switch (e.source_type) {
    case "walk":    return dur ? `${dur} minute walk` : "Walk";
    case "run":     return dur ? `${dur} minute run` : "Run";
    case "cycle":   return dur ? `${dur} minute cycle` : "Cycle";
    case "workout": return dur ? `${dur} minute workout` : "Workout";
    case "sleep":   return dur ? `${(dur / 60).toFixed(1).replace(/\.0$/, "")} hours sleep` : "Sleep";
    default:        return dur ? `${dur} minute activity` : "Activity";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ManualAdapter — always available, no permission needed.
// Represents the "I DID IT" flow. Does not produce automatic events.
// ─────────────────────────────────────────────────────────────────────────────

export class ManualAdapter implements DataSourceAdapter {
  readonly sourceKey: SourceKey = "manual";
  readonly displayName = "Manual";
  readonly isDemo = false;
  readonly isAvailable = true;
  readonly dataDescription = "Things you record yourself using the I DID IT button.";

  async checkAvailability(): Promise<boolean> { return true; }
  async requestPermission(): Promise<PermissionState> { return "granted"; }
  getPermissionState(): PermissionState { return "granted"; }
  async fetchEvents(_since: Date): Promise<AutomaticEvent[]> { return []; }
}

// ─────────────────────────────────────────────────────────────────────────────
// DemoDataAdapter — development only. Generates realistic sample events.
// Unmistakably labelled as demo. Never represented as real data.
// ─────────────────────────────────────────────────────────────────────────────

export class DemoDataAdapter implements DataSourceAdapter {
  readonly sourceKey: SourceKey = "demo";
  readonly displayName = "Demo Data";
  readonly isDemo = true;
  readonly isAvailable = true;
  readonly dataDescription =
    "Sample activities (walks, runs, workouts, sleep) generated for development. Clearly labelled. Not real data.";

  private permState: PermissionState = "unknown";

  async checkAvailability(): Promise<boolean> { return true; }

  async requestPermission(): Promise<PermissionState> {
    this.permState = "granted";
    return "granted";
  }

  getPermissionState(): PermissionState { return this.permState; }

  async fetchEvents(since: Date): Promise<AutomaticEvent[]> {
    if (this.permState !== "granted") return [];

    const events: AutomaticEvent[] = [];
    const now = new Date();

    for (let d = 0; d < 7; d++) {
      const day = new Date(now);
      day.setDate(day.getDate() - d);
      day.setHours(0, 0, 0, 0);

      // Morning walk on most days
      if (Math.random() > 0.3) {
        const ts = new Date(day);
        ts.setHours(7, 30 + Math.floor(Math.random() * 30), 0, 0);
        if (ts >= since) {
          events.push({
            source: "demo",
            source_type: "walk",
            timestamp: ts.toISOString(),
            duration_minutes: 25 + Math.floor(Math.random() * 20),
            metadata: { steps: 3000 + Math.floor(Math.random() * 2000) },
            confidence: "high",
          });
        }
      }

      // Workout on some days
      if (Math.random() > 0.5) {
        const ts = new Date(day);
        ts.setHours(12, Math.floor(Math.random() * 60), 0, 0);
        if (ts >= since) {
          events.push({
            source: "demo",
            source_type: "workout",
            timestamp: ts.toISOString(),
            duration_minutes: 30 + Math.floor(Math.random() * 30),
            metadata: { workoutType: ["yoga", "strength", "pilates"][Math.floor(Math.random() * 3)] },
            confidence: "high",
          });
        }
      }

      // Run on some days
      if (Math.random() > 0.6) {
        const ts = new Date(day);
        ts.setHours(18, Math.floor(Math.random() * 30), 0, 0);
        if (ts >= since) {
          events.push({
            source: "demo",
            source_type: "run",
            timestamp: ts.toISOString(),
            duration_minutes: 20 + Math.floor(Math.random() * 20),
            metadata: { distance_km: 3 + Math.random() * 3 },
            confidence: "high",
          });
        }
      }

      // Sleep every day
      {
        const ts = new Date(day);
        ts.setHours(23, 0, 0, 0);
        ts.setDate(ts.getDate() - 1);
        if (ts >= since) {
          events.push({
            source: "demo",
            source_type: "sleep",
            timestamp: ts.toISOString(),
            duration_minutes: (6 + Math.floor(Math.random() * 3)) * 60 + Math.floor(Math.random() * 30),
            metadata: {},
            confidence: "medium",
          });
        }
      }
    }

    return events.filter(e => new Date(e.timestamp) >= since);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HealthKitAdapter — iOS, via Capacitor plugin.
// Stub: when the native plugin is not present (browser/dev), isAvailable = false.
// When Capacitor is integrated, checkAvailability will detect the plugin and
// requestPermission will trigger the native HealthKit authorization sheet.
// ─────────────────────────────────────────────────────────────────────────────

export class HealthKitAdapter implements DataSourceAdapter {
  readonly sourceKey: SourceKey = "healthkit";
  readonly displayName = "Apple Health";
  readonly isDemo = false;
  readonly isAvailable: boolean = false; // updated dynamically by checkAvailability
  readonly dataDescription =
    "Walks, runs, cycles, workouts, and sleep from Apple Health. Hermentum reads the duration and type of each activity. It does not read your location, heart rate, or any other health detail.";

  private permState: PermissionState = "unknown";

  async checkAvailability(): Promise<boolean> {
    const result = await healthDataService.checkAvailability();
    return result.available;
  }

  async requestPermission(): Promise<PermissionState> {
    this.permState = await healthDataService.requestHealthPermissions();
    return this.permState;
  }

  getPermissionState(): PermissionState { return this.permState; }

  async fetchEvents(since: Date): Promise<AutomaticEvent[]> {
    const records = await healthDataService.getNewHealthData(since);
    return records.map(healthRecordToEvent);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HealthConnectAdapter — Android, via Capacitor plugin.
// Stub: same pattern as HealthKitAdapter.
// ─────────────────────────────────────────────────────────────────────────────

export class HealthConnectAdapter implements DataSourceAdapter {
  readonly sourceKey: SourceKey = "health_connect";
  readonly displayName = "Android Health Connect";
  readonly isDemo = false;
  readonly isAvailable = false;
  readonly dataDescription =
    "Walks, runs, cycles, workouts, and sleep from Android Health Connect. Hermentum reads the duration and type of each activity. It does not read your location, heart rate, or any other health detail.";

  private permState: PermissionState = "unknown";

  async checkAvailability(): Promise<boolean> {
    // When Capacitor is integrated:
    //   const { HealthConnect } = await import('../capacitor/health-connect');
    //   return HealthConnect.isAvailable();
    return false;
  }

  async requestPermission(): Promise<PermissionState> {
    this.permState = "unavailable";
    return "unavailable";
  }

  getPermissionState(): PermissionState { return this.permState; }

  async fetchEvents(_since: Date): Promise<AutomaticEvent[]> {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CalendarAdapter — Cross-platform, via Capacitor plugin.
// Stub: same pattern. Will read calendar events as potential automatic moments.
// ─────────────────────────────────────────────────────────────────────────────

export class CalendarAdapter implements DataSourceAdapter {
  readonly sourceKey: SourceKey = "calendar";
  readonly displayName = "Calendar";
  readonly isDemo = false;
  readonly isAvailable = false;
  readonly dataDescription =
    "Calendar events with a duration (meetings, appointments). Hermentum reads the event title, start time, and duration. It does not read attendee lists, notes, or private details.";

  private permState: PermissionState = "unknown";

  async checkAvailability(): Promise<boolean> {
    // When Capacitor is integrated:
    //   const { Calendar } = await import('../capacitor/calendar');
    //   return Calendar.isAvailable();
    return false;
  }

  async requestPermission(): Promise<PermissionState> {
    this.permState = "unavailable";
    return "unavailable";
  }

  getPermissionState(): PermissionState { return this.permState; }

  async fetchEvents(_since: Date): Promise<AutomaticEvent[]> {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Adapter registry — the app uses this to get all available adapters.
// ─────────────────────────────────────────────────────────────────────────────

export function getAllAdapters(): DataSourceAdapter[] {
  return [
    new HealthKitAdapter(),
    new HealthConnectAdapter(),
    new CalendarAdapter(),
    new DemoDataAdapter(),
  ];
}

export function getAdapter(sourceKey: SourceKey): DataSourceAdapter {
  switch (sourceKey) {
    case "healthkit":       return new HealthKitAdapter();
    case "health_connect": return new HealthConnectAdapter();
    case "calendar":       return new CalendarAdapter();
    case "demo":           return new DemoDataAdapter();
    case "manual":         return new ManualAdapter();
    default:               return new ManualAdapter();
  }
}

// Check if we're running as a native app via Capacitor.
export function isNativeEnvironment(): boolean {
  try {
    // Dynamic import would be async; use the global Capacitor if available.
    const cap = (globalThis as any).Capacitor;
    return !!cap?.isNativePlatform?.();
  } catch {
    return false;
  }
}
