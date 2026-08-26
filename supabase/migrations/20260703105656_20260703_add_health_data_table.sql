/*
# Add health_data table

## Summary
Adds a `health_data` table to store daily health metrics per user,
including steps, sleep hours, and social media usage minutes.
This powers the Apple Health integration and social media tracker
in the Connect tab of the app.

## New Tables

**health_data** — one row per user per calendar day
- id: uuid primary key
- user_id: uuid FK → users.id (defaults to auth.uid())
- date: calendar date
- steps: step count for the day (from motion sensor or manual entry)
- sleep_hours: hours of sleep (0–24, 1 decimal place)
- social_media_minutes: minutes spent on social media today
- created_at: timestamp

## Security
RLS enabled, owner-scoped CRUD policies (authenticated only).
*/

CREATE TABLE IF NOT EXISTS health_data (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL DEFAULT auth.uid() REFERENCES users(id) ON DELETE CASCADE,
  date                 date NOT NULL,
  steps                integer NOT NULL DEFAULT 0,
  sleep_hours          numeric(4,1) NOT NULL DEFAULT 0,
  social_media_minutes integer NOT NULL DEFAULT -1,
  created_at           timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

ALTER TABLE health_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_health_data" ON health_data;
CREATE POLICY "select_own_health_data" ON health_data FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_health_data" ON health_data;
CREATE POLICY "insert_own_health_data" ON health_data FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_health_data" ON health_data;
CREATE POLICY "update_own_health_data" ON health_data FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_health_data" ON health_data;
CREATE POLICY "delete_own_health_data" ON health_data FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
