/*
# Add confidence and duration columns to moments, add calendar to data_sources

## Summary
Adds `confidence` (text, nullable) and `duration_minutes` (integer, nullable)
to the moments table to support automatic events that carry these fields.
Also adds the Calendar source to the data_sources reference table.

## Changes
1. ALTER TABLE moments ADD COLUMN confidence text — stores adapter confidence
   level: "high", "medium", "low", or NULL for manual moments.
2. ALTER TABLE moments ADD COLUMN duration_minutes integer — stores duration
   in minutes for activities that have one (walks, runs, workouts, sleep).
   NULL for manual moments or activities without duration.
3. INSERT INTO data_sources for 'calendar' source.

## Security
No RLS policy changes needed — existing policies already cover the new columns.
*/

ALTER TABLE moments ADD COLUMN IF NOT EXISTS confidence text;
ALTER TABLE moments ADD COLUMN IF NOT EXISTS duration_minutes integer;

INSERT INTO data_sources (key, label, platform) VALUES
  ('calendar', 'Calendar', 'cross')
ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label, platform = EXCLUDED.platform;
