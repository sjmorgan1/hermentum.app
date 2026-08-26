/*
# Migrate Hermentum to auth-based user tables

## Summary
Migrates the app from anonymous session_id-based data to Supabase
anonymous auth-based user isolation (auth.uid()). Creates new profile,
onboarding, and scoring tables. Alters existing daily_wins to add
user_id and per-win metadata columns.

## Changes

### New Tables

**users** — user profile created at onboarding completion
- id: uuid primary key, defaults to auth.uid() (maps to auth.users.id)
- email: optional email text
- name: display name from onboarding step 1
- created_at: timestamp

**onboarding_responses** — 7-screen questionnaire answers
- id: uuid primary key
- user_id: uuid → users.id, defaults to auth.uid()
- life_situation: text array (screen 2 life situation picks)
- struggles: text array (screen 3 struggle picks)
- connected_apps: text array (screen 4 app picks)
- permissions: text array (screen 5 data permission toggles)
- primary_goal: text (screen 6 single-select)
- notification_preference: text (screen 7 single-select)
- created_at: timestamp

**user_scores** — calculated daily score snapshots
- id: uuid primary key
- user_id: uuid → users.id, defaults to auth.uid()
- date: calendar date
- score: percentage score 0-100
- total_points: raw earned points
- created_at: timestamp
- UNIQUE(user_id, date)

### Modified Tables

**daily_wins** — adds per-user auth columns alongside existing session_id
- Added: user_id uuid (nullable FK → users.id, for authenticated rows)
- Added: win_label text (display label of the win)
- Added: points integer (points awarded)
- Added: UNIQUE(user_id, win_id, date) constraint for upsert support
- Updated: RLS policies changed from anon/session to authenticated/user_id

## Security
RLS enabled on all new tables. daily_wins policies updated to authenticate
via auth.uid() = user_id. Old anon-based wins (null user_id) are not visible
to authenticated users — this is intentional, clean-slate behaviour.
*/

-- ─── users ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id         uuid PRIMARY KEY DEFAULT auth.uid(),
  email      text,
  name       text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_user" ON users;
CREATE POLICY "select_own_user" ON users FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_user" ON users;
CREATE POLICY "insert_own_user" ON users FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_user" ON users;
CREATE POLICY "update_own_user" ON users FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "delete_own_user" ON users;
CREATE POLICY "delete_own_user" ON users FOR DELETE
  TO authenticated USING (auth.uid() = id);

-- ─── alter daily_wins ─────────────────────────────────────────────────────────

ALTER TABLE daily_wins
  ADD COLUMN IF NOT EXISTS user_id   uuid REFERENCES users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS win_label text,
  ADD COLUMN IF NOT EXISTS points    integer;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'daily_wins_user_win_date_key'
    AND conrelid = 'daily_wins'::regclass
  ) THEN
    ALTER TABLE daily_wins
      ADD CONSTRAINT daily_wins_user_win_date_key UNIQUE (user_id, win_id, date);
  END IF;
END $$;

DROP POLICY IF EXISTS "select_own_wins" ON daily_wins;
CREATE POLICY "select_own_wins" ON daily_wins FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_wins" ON daily_wins;
CREATE POLICY "insert_own_wins" ON daily_wins FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_wins" ON daily_wins;
CREATE POLICY "update_own_wins" ON daily_wins FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_wins" ON daily_wins;
CREATE POLICY "delete_own_wins" ON daily_wins FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ─── onboarding_responses ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS onboarding_responses (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid NOT NULL DEFAULT auth.uid() REFERENCES users(id) ON DELETE CASCADE,
  life_situation          text[] DEFAULT '{}',
  struggles               text[] DEFAULT '{}',
  connected_apps          text[] DEFAULT '{}',
  permissions             text[] DEFAULT '{}',
  primary_goal            text,
  notification_preference text,
  created_at              timestamptz DEFAULT now()
);

ALTER TABLE onboarding_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_onboarding" ON onboarding_responses;
CREATE POLICY "select_own_onboarding" ON onboarding_responses FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_onboarding" ON onboarding_responses;
CREATE POLICY "insert_own_onboarding" ON onboarding_responses FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_onboarding" ON onboarding_responses;
CREATE POLICY "update_own_onboarding" ON onboarding_responses FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_onboarding" ON onboarding_responses;
CREATE POLICY "delete_own_onboarding" ON onboarding_responses FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ─── user_scores ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_scores (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL DEFAULT auth.uid() REFERENCES users(id) ON DELETE CASCADE,
  date         date NOT NULL,
  score        integer NOT NULL DEFAULT 0,
  total_points integer NOT NULL DEFAULT 0,
  created_at   timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

ALTER TABLE user_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_scores" ON user_scores;
CREATE POLICY "select_own_scores" ON user_scores FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_scores" ON user_scores;
CREATE POLICY "insert_own_scores" ON user_scores FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_scores" ON user_scores;
CREATE POLICY "update_own_scores" ON user_scores FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_scores" ON user_scores;
CREATE POLICY "delete_own_scores" ON user_scores FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
