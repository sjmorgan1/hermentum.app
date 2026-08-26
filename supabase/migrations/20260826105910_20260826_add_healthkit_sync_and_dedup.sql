/*
# Add HealthKit sync tracking and deduplication support

## Summary
Adds the infrastructure needed for real Apple Health (HealthKit) integration:
1. A `last_healthkit_sync_at` timestamp on `user_preferences` so we can resume
   syncs from the last successful point per user.
2. An `external_id` text column on `moments` so the same HealthKit workout
   never produces two Hermentum moments (deduplication).
3. A partial unique index on `(user_id, source, external_id)` for
   healthkit-sourced rows, enforcing deduplication at the database level.

## Changes
1. `user_preferences.last_healthkit_sync_at` (timestamptz, nullable) — stores
   the timestamp of the last successful HealthKit sync for this user. NULL
   means no sync has happened yet (first connect will trigger initial import).
2. `moments.external_id` (text, nullable) — stores the stable HealthKit
   object UUID (or aggregated key) for automatic moments. NULL for manual
   moments. Used to deduplicate across repeated syncs and across Apple Watch
   / iPhone / other HealthKit sources.
3. Partial unique index `idx_moments_user_source_extid_unique` on
   `(user_id, source, external_id)` WHERE `external_id IS NOT NULL` —
   prevents two moments with the same external_id from existing for one user.
   This is the database-level deduplication guarantee.

## Security
- No RLS policy changes needed — existing policies already cover the new
  columns. Only the owner can read/write their own moments and preferences.
- The unique index does not expose any new data; it only enforces integrity.

## Important Notes
1. The `external_id` column is nullable so existing manual moments are
   unaffected. Only healthkit-sourced moments carry an external_id.
2. The unique index is partial (WHERE external_id IS NOT NULL) so manual
   moments with NULL external_id are not constrained.
3. If a duplicate insert is attempted, Postgres raises a unique violation
   which the app layer catches and treats as a skipped duplicate.
*/

-- 1. Add last_healthkit_sync_at to user_preferences
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS last_healthkit_sync_at timestamptz;

-- 2. Add external_id to moments for deduplication
ALTER TABLE moments
  ADD COLUMN IF NOT EXISTS external_id text;

-- 3. Partial unique index to enforce deduplication at the DB level
--    Only applies to moments that have an external_id (healthkit-sourced).
CREATE UNIQUE INDEX IF NOT EXISTS idx_moments_user_source_extid_unique
  ON moments (user_id, source, external_id)
  WHERE external_id IS NOT NULL;
