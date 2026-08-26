/*
# Add social_media_app_log table

## Summary
Adds a `social_media_app_log` table to store per-app social media usage
minutes for each user per day. This powers the per-app social media tracker
in the Health tab, letting users quickly log how long they spent on Instagram,
TikTok, YouTube, etc. each day.

## New Tables

**social_media_app_log** — one row per user per app per calendar day
- id: uuid primary key
- user_id: uuid FK → users.id (defaults to auth.uid())
- date: calendar date
- app_name: name of the social media app (e.g. "Instagram")
- minutes: minutes spent on this app today
- created_at: timestamp
- UNIQUE(user_id, date, app_name) — one row per app per day per user

## Security
RLS enabled, owner-scoped CRUD policies (authenticated only).
*/

CREATE TABLE IF NOT EXISTS social_media_app_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL DEFAULT auth.uid() REFERENCES users(id) ON DELETE CASCADE,
  date       date NOT NULL,
  app_name   text NOT NULL,
  minutes    integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date, app_name)
);

CREATE INDEX IF NOT EXISTS social_media_app_log_user_date_idx
  ON social_media_app_log(user_id, date);

ALTER TABLE social_media_app_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_social_log" ON social_media_app_log;
CREATE POLICY "select_own_social_log" ON social_media_app_log FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_social_log" ON social_media_app_log;
CREATE POLICY "insert_own_social_log" ON social_media_app_log FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_social_log" ON social_media_app_log;
CREATE POLICY "update_own_social_log" ON social_media_app_log FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_social_log" ON social_media_app_log;
CREATE POLICY "delete_own_social_log" ON social_media_app_log FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
