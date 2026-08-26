import { supabase } from "./supabase";
import { healthDataService, healthRecordToEvent } from "./healthDataService";
import { eventLabel } from "./datasource";
import { createMoment } from "./moments";
import { track } from "./analytics";

// ─────────────────────────────────────────────────────────────────────────────
// HealthKit sync engine.
//
// Responsibilities:
//   1. Track last_healthkit_sync_at per user.
//   2. Fetch new HealthKit records since the last sync (with a small overlap
//      window to protect against late-arriving data).
//   3. Deduplicate against existing moments by external_id so the same
//      HealthKit workout never produces two Hermentum moments.
//   4. Create new automatic moments (source = "healthkit", source_type =
//      "automatic") with purely factual labels — no interpretation.
// ─────────────────────────────────────────────────────────────────────────────

export type ImportScope = "today" | "week" | "month";

const OVERLAP_MINUTES = 30;

export interface SyncResult {
  imported: number;
  skippedDuplicates: number;
  unavailable: boolean;
  error?: string;
  lastSyncAt: string | null;
}

/** Get the stored last sync timestamp for the current user. */
export async function getLastSyncAt(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;

  const { data } = await supabase
    .from("user_preferences")
    .select("last_healthkit_sync_at")
    .eq("user_id", session.user.id)
    .maybeSingle();

  return data?.last_healthkit_sync_at ?? null;
}

/** Update the stored last sync timestamp. */
export async function setLastSyncAt(timestamp: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return;

  await supabase
    .from("user_preferences")
    .upsert({
      user_id: session.user.id,
      last_healthkit_sync_at: timestamp,
    }, { onConflict: "user_id" });
}

/** Compute the "since" date for an initial import based on the chosen scope. */
export function scopeToSince(scope: ImportScope): Date {
  const now = new Date();
  switch (scope) {
    case "today": {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case "week": {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      return d;
    }
    case "month": {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      return d;
    }
  }
}

/**
 * Run a sync: fetch new HealthKit records since the last sync (with overlap),
 * deduplicate against existing moments, and create new automatic moments.
 */
export async function syncHealthData(): Promise<SyncResult> {
  const avail = await healthDataService.checkAvailability();
  if (!avail.available) {
    return { imported: 0, skippedDuplicates: 0, unavailable: true, lastSyncAt: null };
  }

  const permState = await healthDataService.getAuthorizationStatus();
  if (permState !== "granted") {
    return { imported: 0, skippedDuplicates: 0, unavailable: false, lastSyncAt: null, error: "not_authorized" };
  }

  const lastSync = await getLastSyncAt();
  const since = computeSinceDate(lastSync);

  return runSync(since, lastSync);
}

/**
 * Run an initial import with a user-chosen scope (today / week / month).
 * Used when the user first connects Apple Health.
 */
export async function initialHealthImport(scope: ImportScope): Promise<SyncResult> {
  const avail = await healthDataService.checkAvailability();
  if (!avail.available) {
    return { imported: 0, skippedDuplicates: 0, unavailable: true, lastSyncAt: null };
  }

  const permState = await healthDataService.getAuthorizationStatus();
  if (permState !== "granted") {
    return { imported: 0, skippedDuplicates: 0, unavailable: false, lastSyncAt: null, error: "not_authorized" };
  }

  const since = scopeToSince(scope);
  const lastSync = await getLastSyncAt();
  return runSync(since, lastSync);
}

async function runSync(since: Date, lastSync: string | null): Promise<SyncResult> {
  try {
    const records = await healthDataService.getNewHealthData(since);
    if (records.length === 0) {
      const now = new Date().toISOString();
      await setLastSyncAt(now);
      return { imported: 0, skippedDuplicates: 0, unavailable: false, lastSyncAt: now };
    }

    // Fetch existing external_ids for this user to deduplicate.
    const existingIds = await fetchExistingExternalIds(records.map(r => r.externalId));
    let imported = 0;
    let skipped = 0;

    for (const record of records) {
      if (existingIds.has(record.externalId)) {
        skipped++;
        continue;
      }
      const event = healthRecordToEvent(record);
      try {
        const moment = await createMoment({
          category: "me",
          source: "healthkit",
          source_type: "automatic",
          source_metadata: {
            label: eventLabel(event),
            ...event.metadata,
          },
          timestamp: record.startTime,
          confidence: event.confidence,
          duration_minutes: record.durationMinutes,
          external_id: record.externalId,
        });

        if (moment) {
          existingIds.add(record.externalId);
          imported++;
          track("automatic_moment_created", {
            source: "healthkit",
            source_type: record.activityType,
            is_demo: false,
          });
        }
      } catch (err) {
        // A unique constraint violation means a duplicate was inserted by a
        // concurrent sync — treat it as a skip, not an error.
        if (isUniqueViolation(err)) {
          skipped++;
          existingIds.add(record.externalId);
        } else {
          // Re-throw unexpected errors so the outer catch handles them.
          throw err;
        }
      }
    }

    const now = new Date().toISOString();
    await setLastSyncAt(now);

    return { imported, skippedDuplicates: skipped, unavailable: false, lastSyncAt: now };
  } catch (err) {
    const message = err instanceof Error ? err.message : "sync_failed";
    return {
      imported: 0,
      skippedDuplicates: 0,
      unavailable: false,
      error: message,
      lastSyncAt: lastSync,
    };
  }
}

/** Compute the sync start date: last sync minus the overlap window. */
function computeSinceDate(lastSync: string | null): Date {
  if (!lastSync) {
    // No previous sync — default to one week ago.
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d;
  }
  const d = new Date(lastSync);
  d.setMinutes(d.getMinutes() - OVERLAP_MINUTES);
  return d;
}

/**
 * Fetch existing external_ids from moments for the current user to check for
 * duplicates. We query source_metadata->>'external_id' for healthkit moments.
 */
async function fetchExistingExternalIds(candidateIds: string[]): Promise<Set<string>> {
  if (candidateIds.length === 0) return new Set();

  const { data, error } = await supabase
    .from("moments")
    .select("source_metadata")
    .eq("source", "healthkit")
    .in("source_metadata->>external_id", candidateIds);

  if (error || !data) return new Set();

  const ids = new Set<string>();
  for (const row of data) {
    const meta = row.source_metadata as Record<string, unknown> | null;
    const extId = meta?.external_id;
    if (typeof extId === "string") ids.add(extId);
  }
  return ids;
}

/** Check if a Postgres error is a unique constraint violation (code 23505). */
function isUniqueViolation(err: unknown): boolean {
  if (typeof err === "object" && err !== null) {
    const e = err as { code?: string };
    return e.code === "23505";
  }
  return false;
}
