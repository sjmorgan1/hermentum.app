/*
# Rebuild Hermentum as a private life-record app

## Summary
Replaces the old gamified wins/points/scores system with a calm, private,
chronological life-record. Creates new tables for moments, categories,
data sources, connected accounts, user preferences, weekly witnesses,
monthly records, analytics events, and dormant rewards architecture.
Also creates database functions for weekly witness generation and
aggregate admin metrics.

## New Tables

1. **moment_categories** — the five fixed categories (CARE, HOME, WORK, LIFE, FOR ME)
   - id (uuid PK), key (text unique), label (text), display_order (int), created_at

2. **moments** — the core record: each thing a woman did
   - id (uuid PK), user_id (uuid → auth.users, DEFAULT auth.uid()), timestamp (timestamptz),
     category (text), note (text, optional), source (text: manual|healthkit|health_connect|calendar|demo),
     source_type (text: walk|run|workout|sleep|cycle|manual|...), source_metadata (jsonb),
     is_demo (boolean default false), dismissed (boolean default false), created_at, updated_at
   - Index on (user_id, timestamp) for timeline queries
   - Index on (user_id, source) for automatic moment queries

3. **data_sources** — catalog of automatic sources the app can connect
   - id (uuid PK), key (text unique: healthkit|health_connect|calendar|...),
     label (text), platform (text: ios|android|cross), is_active (bool), created_at

4. **connected_accounts** — which sources each user has authorised
   - id (uuid PK), user_id (uuid → auth.users, DEFAULT auth.uid()),
     source_key (text), connected_at (timestamptz), disconnected_at (timestamptz nullable),
     metadata (jsonb)
   - Unique on (user_id, source_key) where disconnected_at IS NULL via partial index

5. **user_preferences** — notification and privacy settings per user
   - id (uuid PK), user_id (uuid → auth.users, DEFAULT auth.uid()),
     notification_frequency (text: daily|celebrate|weekly|none, default 'weekly'),
     privacy_acknowledged (bool default false), created_at, updated_at
   - Unique on user_id

6. **weekly_witnesses** — generated factual reflections, one per user per ISO week
   - id (uuid PK), user_id (uuid → auth.users, DEFAULT auth.uid()),
     week_start (date), week_end (date), summary (text), stats (jsonb), created_at
   - Unique on (user_id, week_start)

7. **monthly_records** — monthly archive summaries
   - id (uuid PK), user_id (uuid → auth.users, DEFAULT auth.uid()),
     month (date, first of month), total_moments (int), days_recorded (int),
     category_breakdown (jsonb), automatic_count (int), manual_count (int), created_at
   - Unique on (user_id, month)

8. **analytics_events** — internal product analytics
   - id (uuid PK), user_id (uuid → auth.users, DEFAULT auth.uid()),
     event_name (text), event_data (jsonb), session_id (text nullable), created_at
   - Index on (user_id, created_at) and (event_name, created_at)

9. **partners** (dormant) — future rewards partners
   - id (uuid PK), name (text), created_at

10. **rewards** (dormant) — future rewards
    - id (uuid PK), partner_id (uuid → partners), name (text), description (text),
      unlock_threshold (int), created_at

11. **redemptions** (dormant) — future reward redemptions
    - id (uuid PK), user_id (uuid → auth.users), reward_id (uuid → rewards),
      redeemed_at (timestamptz), created_at

12. **eligibility_rules** (dormant) — future reward eligibility logic
    - id (uuid PK), reward_id (uuid → rewards), rule_type (text), rule_config (jsonb), created_at

## Database Functions

1. **generate_weekly_witness(p_user_id uuid, p_week_start date)**
   - Analyses a user's moments for the given ISO week (Mon–Sun).
   - Computes total moments, days active, category counts, source counts,
     busiest day, and "for me" count.
   - Generates 2–3 restrained factual sentences using deterministic templates.
   - Upserts the result into weekly_witnesses and returns the summary text.
   - SECURITY DEFINER so it can read the user's moments regardless of RLS context.

2. **get_admin_metrics()**
   - Returns a single JSON blob with aggregate, non-private metrics:
     total users, active users (last 7 days), moments today, average moments
     per active user, manual vs automatic moments, day-7 retention,
     and category distribution.
   - SECURITY DEFINER, callable by authenticated users only.

## Security
- RLS enabled on ALL new tables.
- moments, connected_accounts, user_preferences, weekly_witnesses,
  monthly_records, analytics_events, redemptions: owner-scoped CRUD
  (auth.uid() = user_id) with DEFAULT auth.uid() on user_id.
- moment_categories, data_sources, partners, rewards, eligibility_rules:
  read-only for authenticated users (catalog/reference data). No inserts
  from the client; managed via migrations or admin tools.
- Functions are SECURITY DEFINER so they bypass RLS for aggregation,
  but they only expose aggregate/non-private data.

## Important Notes
1. The old tables (daily_wins, user_scores, health_data, social_media_app_log,
   onboarding_responses, user_profiles) are left in place — not dropped —
   to preserve existing data. The new app simply stops using them.
2. Demo moments are flagged with is_demo = true so they can be clearly
   distinguished from real user data.
3. The moments table is designed so new automatic sources can be added
   without schema changes — source and source_type are free-text columns
   and source_metadata is jsonb.
*/

-- ═══════════════════════════════════════════════════════════════════════════
-- MOMENT CATEGORIES (reference data)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS moment_categories (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key           text UNIQUE NOT NULL,
  label         text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE moment_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_categories" ON moment_categories;
CREATE POLICY "read_categories" ON moment_categories FOR SELECT
  TO authenticated USING (true);

-- Seed the five categories
INSERT INTO moment_categories (key, label, display_order) VALUES
  ('care',  'CARE',   1),
  ('home',  'HOME',   2),
  ('work',  'WORK',   3),
  ('life',  'LIFE',   4),
  ('me',    'FOR ME', 5)
ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label, display_order = EXCLUDED.display_order;

-- ═══════════════════════════════════════════════════════════════════════════
-- MOMENTS (the core record)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS moments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  timestamp       timestamptz NOT NULL DEFAULT now(),
  category        text NOT NULL,
  note            text,
  source          text NOT NULL DEFAULT 'manual',
  source_type     text NOT NULL DEFAULT 'manual',
  source_metadata jsonb DEFAULT '{}'::jsonb,
  is_demo         boolean NOT NULL DEFAULT false,
  dismissed       boolean NOT NULL DEFAULT false,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE moments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_moments_user_ts ON moments (user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_moments_user_source ON moments (user_id, source);
CREATE INDEX IF NOT EXISTS idx_moments_user_category ON moments (user_id, category);

DROP POLICY IF EXISTS "select_own_moments" ON moments;
CREATE POLICY "select_own_moments" ON moments FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_moments" ON moments;
CREATE POLICY "insert_own_moments" ON moments FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_moments" ON moments;
CREATE POLICY "update_own_moments" ON moments FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_moments" ON moments;
CREATE POLICY "delete_own_moments" ON moments FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- DATA SOURCES (reference data)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS data_sources (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key        text UNIQUE NOT NULL,
  label      text NOT NULL,
  platform   text NOT NULL DEFAULT 'cross',
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE data_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_data_sources" ON data_sources;
CREATE POLICY "read_data_sources" ON data_sources FOR SELECT
  TO authenticated USING (true);

INSERT INTO data_sources (key, label, platform) VALUES
  ('healthkit',      'Apple HealthKit',       'ios'),
  ('health_connect', 'Android Health Connect','android'),
  ('calendar',       'Calendar',              'cross'),
  ('demo',           'Demo Data',             'cross')
ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label, platform = EXCLUDED.platform;

-- ═══════════════════════════════════════════════════════════════════════════
-- CONNECTED ACCOUNTS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS connected_accounts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  source_key      text NOT NULL,
  connected_at    timestamptz NOT NULL DEFAULT now(),
  disconnected_at timestamptz,
  metadata        jsonb DEFAULT '{}'::jsonb
);

ALTER TABLE connected_accounts ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS idx_connected_accounts_user_source_active
  ON connected_accounts (user_id, source_key)
  WHERE disconnected_at IS NULL;

DROP POLICY IF EXISTS "select_own_connections" ON connected_accounts;
CREATE POLICY "select_own_connections" ON connected_accounts FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_connections" ON connected_accounts;
CREATE POLICY "insert_own_connections" ON connected_accounts FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_connections" ON connected_accounts;
CREATE POLICY "update_own_connections" ON connected_accounts FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_connections" ON connected_accounts;
CREATE POLICY "delete_own_connections" ON connected_accounts FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- USER PREFERENCES
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_preferences (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_frequency text NOT NULL DEFAULT 'weekly',
  privacy_acknowledged  boolean NOT NULL DEFAULT false,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_preferences_user ON user_preferences (user_id);

DROP POLICY IF EXISTS "select_own_prefs" ON user_preferences;
CREATE POLICY "select_own_prefs" ON user_preferences FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_prefs" ON user_preferences;
CREATE POLICY "insert_own_prefs" ON user_preferences FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_prefs" ON user_preferences;
CREATE POLICY "update_own_prefs" ON user_preferences FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_prefs" ON user_preferences;
CREATE POLICY "delete_own_prefs" ON user_preferences FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- WEEKLY WITNESSES
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS weekly_witnesses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start  date NOT NULL,
  week_end    date NOT NULL,
  summary     text NOT NULL,
  stats       jsonb DEFAULT '{}'::jsonb,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE weekly_witnesses ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS idx_weekly_witnesses_user_week ON weekly_witnesses (user_id, week_start);

DROP POLICY IF EXISTS "select_own_witnesses" ON weekly_witnesses;
CREATE POLICY "select_own_witnesses" ON weekly_witnesses FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_witnesses" ON weekly_witnesses;
CREATE POLICY "insert_own_witnesses" ON weekly_witnesses FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_witnesses" ON weekly_witnesses;
CREATE POLICY "update_own_witnesses" ON weekly_witnesses FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_witnesses" ON weekly_witnesses;
CREATE POLICY "delete_own_witnesses" ON weekly_witnesses FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- MONTHLY RECORDS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS monthly_records (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  month             date NOT NULL,
  total_moments     integer NOT NULL DEFAULT 0,
  days_recorded    integer NOT NULL DEFAULT 0,
  category_breakdown jsonb DEFAULT '{}'::jsonb,
  automatic_count  integer NOT NULL DEFAULT 0,
  manual_count     integer NOT NULL DEFAULT 0,
  created_at        timestamptz DEFAULT now()
);

ALTER TABLE monthly_records ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS idx_monthly_records_user_month ON monthly_records (user_id, month);

DROP POLICY IF EXISTS "select_own_monthly" ON monthly_records;
CREATE POLICY "select_own_monthly" ON monthly_records FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_monthly" ON monthly_records;
CREATE POLICY "insert_own_monthly" ON monthly_records FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_monthly" ON monthly_records;
CREATE POLICY "update_own_monthly" ON monthly_records FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_monthly" ON monthly_records;
CREATE POLICY "delete_own_monthly" ON monthly_records FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- ANALYTICS EVENTS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS analytics_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  event_name  text NOT NULL,
  event_data  jsonb DEFAULT '{}'::jsonb,
  session_id  text,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_analytics_user_ts ON analytics_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_event_ts ON analytics_events (event_name, created_at DESC);

-- Users can insert their own events but cannot read them back (write-only)
DROP POLICY IF EXISTS "insert_own_events" ON analytics_events;
CREATE POLICY "insert_own_events" ON analytics_events FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- DORMANT REWARDS ARCHITECTURE
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS partners (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_partners" ON partners;
CREATE POLICY "read_partners" ON partners FOR SELECT
  TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS rewards (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id        uuid REFERENCES partners(id) ON DELETE CASCADE,
  name              text NOT NULL,
  description       text,
  unlock_threshold  integer,
  created_at        timestamptz DEFAULT now()
);

ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_rewards" ON rewards;
CREATE POLICY "read_rewards" ON rewards FOR SELECT
  TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS redemptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_id   uuid REFERENCES rewards(id) ON DELETE CASCADE,
  redeemed_at timestamptz DEFAULT now(),
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_redemptions" ON redemptions;
CREATE POLICY "select_own_redemptions" ON redemptions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_redemptions" ON redemptions;
CREATE POLICY "insert_own_redemptions" ON redemptions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_redemptions" ON redemptions;
CREATE POLICY "delete_own_redemptions" ON redemptions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS eligibility_rules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reward_id   uuid REFERENCES rewards(id) ON DELETE CASCADE,
  rule_type   text NOT NULL,
  rule_config jsonb DEFAULT '{}'::jsonb,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE eligibility_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_eligibility" ON eligibility_rules;
CREATE POLICY "read_eligibility" ON eligibility_rules FOR SELECT
  TO authenticated USING (true);

-- ═══════════════════════════════════════════════════════════════════════════
-- UPDATED_AT TRIGGER FOR MOMENTS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_moments_updated_at ON moments;
CREATE TRIGGER trg_moments_updated_at
  BEFORE UPDATE ON moments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_user_preferences_updated_at ON user_preferences;
CREATE TRIGGER trg_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════
-- WEEKLY WITNESS GENERATION FUNCTION
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION generate_weekly_witness(p_user_id uuid, p_week_start date)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_week_end     date := p_week_start + 6;
  v_total        integer;
  v_days_active  integer;
  v_manual       integer;
  v_auto         integer;
  v_for_me       integer;
  v_care         integer;
  v_busiest_day  text;
  v_busiest_count integer;
  v_summary      text := '';
  v_stats        jsonb;
  v_day_counts   jsonb;
  v_cat_counts   jsonb;
  v_source_counts jsonb;
BEGIN
  -- Total non-dismissed moments in the week
  SELECT count(*) INTO v_total
  FROM moments
  WHERE user_id = p_user_id
    AND dismissed = false
    AND timestamp >= p_week_start::timestamptz
    AND timestamp < (v_week_end + 1)::timestamptz;

  IF v_total = 0 THEN
    v_summary := 'No moments recorded this week yet. When you are ready, the record is here.';
    v_stats := jsonb_build_object('total', 0, 'days_active', 0);
    INSERT INTO weekly_witnesses (user_id, week_start, week_end, summary, stats)
    VALUES (p_user_id, p_week_start, v_week_end, v_summary, v_stats)
    ON CONFLICT (user_id, week_start) DO UPDATE SET summary = EXCLUDED.summary, stats = EXCLUDED.stats;
    RETURN v_summary;
  END IF;

  -- Days active (distinct dates with at least one moment)
  SELECT count(DISTINCT date(timestamp)) INTO v_days_active
  FROM moments
  WHERE user_id = p_user_id
    AND dismissed = false
    AND timestamp >= p_week_start::timestamptz
    AND timestamp < (v_week_end + 1)::timestamptz;

  -- Manual vs automatic
  SELECT
    count(*) FILTER (WHERE source = 'manual'),
    count(*) FILTER (WHERE source != 'manual')
  INTO v_manual, v_auto
  FROM moments
  WHERE user_id = p_user_id
    AND dismissed = false
    AND timestamp >= p_week_start::timestamptz
    AND timestamp < (v_week_end + 1)::timestamptz;

  -- For me count
  SELECT count(*) INTO v_for_me
  FROM moments
  WHERE user_id = p_user_id
    AND dismissed = false
    AND category = 'me'
    AND timestamp >= p_week_start::timestamptz
    AND timestamp < (v_week_end + 1)::timestamptz;

  -- Care count
  SELECT count(*) INTO v_care
  FROM moments
  WHERE user_id = p_user_id
    AND dismissed = false
    AND category = 'care'
    AND timestamp >= p_week_start::timestamptz
    AND timestamp < (v_week_end + 1)::timestamptz;

  -- Category counts
  SELECT COALESCE(jsonb_object_agg(category, cnt), '{}'::jsonb) INTO v_cat_counts
  FROM (
    SELECT category, count(*) as cnt
    FROM moments
    WHERE user_id = p_user_id
      AND dismissed = false
      AND timestamp >= p_week_start::timestamptz
      AND timestamp < (v_week_end + 1)::timestamptz
    GROUP BY category
  ) t;

  -- Source counts
  SELECT COALESCE(jsonb_object_agg(source, cnt), '{}'::jsonb) INTO v_source_counts
  FROM (
    SELECT source, count(*) as cnt
    FROM moments
    WHERE user_id = p_user_id
      AND dismissed = false
      AND timestamp >= p_week_start::timestamptz
      AND timestamp < (v_week_end + 1)::timestamptz
    GROUP BY source
  ) t;

  -- Busiest day
  SELECT to_char(date(timestamp), 'Day'), count(*) INTO v_busiest_day, v_busiest_count
  FROM moments
  WHERE user_id = p_user_id
    AND dismissed = false
    AND timestamp >= p_week_start::timestamptz
    AND timestamp < (v_week_end + 1)::timestamptz
  GROUP BY date(timestamp)
  ORDER BY count(*) DESC
  LIMIT 1;

  v_busiest_day := btrim(v_busiest_day);

  v_stats := jsonb_build_object(
    'total', v_total,
    'days_active', v_days_active,
    'manual', v_manual,
    'automatic', v_auto,
    'for_me', v_for_me,
    'care', v_care,
    'categories', v_cat_counts,
    'sources', v_source_counts,
    'busiest_day', v_busiest_day,
    'busiest_count', v_busiest_count
  );

  -- Build restrained, factual sentences
  v_summary := 'This week you recorded ' || v_total || ' moment' || CASE WHEN v_total != 1 THEN 's' ELSE '' END || '.';

  v_summary := v_summary || ' You showed up on ' || v_days_active || ' of 7 days.';

  IF v_care > 0 AND v_care >= v_total / 3 THEN
    v_summary := v_summary || ' ' || v_care || ' involved caring for someone else.';
  ELSIF v_for_me > 0 THEN
    v_summary := v_summary || ' ' || v_for_me || ' were things you did specifically for you.';
  ELSIF v_auto > 0 THEN
    v_summary := v_summary || ' ' || v_auto || ' were noticed automatically.';
  END IF;

  IF v_busiest_count IS NOT NULL AND v_busiest_count > 3 THEN
    v_summary := v_summary || ' ' || v_busiest_day || ' looks like it was a lot.';
  END IF;

  INSERT INTO weekly_witnesses (user_id, week_start, week_end, summary, stats)
  VALUES (p_user_id, p_week_start, v_week_end, v_summary, v_stats)
  ON CONFLICT (user_id, week_start) DO UPDATE SET summary = EXCLUDED.summary, stats = EXCLUDED.stats;

  RETURN v_summary;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- ADMIN METRICS FUNCTION
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_admin_metrics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_users    integer;
  v_active_users   integer;
  v_moments_today  integer;
  v_avg_moments    numeric;
  v_manual_today   integer;
  v_auto_today     integer;
  v_d7_retention   numeric;
  v_cat_dist       jsonb;
BEGIN
  -- Total users (from users table)
  SELECT count(*) INTO v_total_users FROM users;

  -- Active users: users with at least one moment in the last 7 days
  SELECT count(DISTINCT user_id) INTO v_active_users
  FROM moments
  WHERE timestamp >= now() - interval '7 days'
    AND dismissed = false;

  -- Moments today
  SELECT count(*) INTO v_moments_today
  FROM moments
  WHERE date(timestamp) = current_date
    AND dismissed = false;

  -- Average moments per active user (last 7 days)
  SELECT COALESCE(avg(cnt), 0) INTO v_avg_moments
  FROM (
    SELECT user_id, count(*) as cnt
    FROM moments
    WHERE timestamp >= now() - interval '7 days'
      AND dismissed = false
    GROUP BY user_id
  ) t;

  -- Manual vs automatic today
  SELECT
    count(*) FILTER (WHERE source = 'manual'),
    count(*) FILTER (WHERE source != 'manual')
  INTO v_manual_today, v_auto_today
  FROM moments
  WHERE date(timestamp) = current_date
    AND dismissed = false;

  -- Day 7 retention: users who created their first moment 7+ days ago
  -- AND have a moment in the last 7 days
  SELECT
    CASE
      WHEN count(*) > 0 THEN
        round(count(*) FILTER (WHERE recent > 0)::numeric / count(*)::numeric, 2)
      ELSE 0
    END
  INTO v_d7_retention
  FROM (
    SELECT
      u.id,
      (SELECT count(*) FROM moments WHERE user_id = u.id AND timestamp >= now() - interval '7 days' AND dismissed = false) as recent
    FROM users u
    WHERE u.created_at <= now() - interval '7 days'
  ) t;

  -- Category distribution (last 30 days)
  SELECT COALESCE(jsonb_object_agg(category, cnt), '{}'::jsonb) INTO v_cat_dist
  FROM (
    SELECT category, count(*) as cnt
    FROM moments
    WHERE timestamp >= now() - interval '30 days'
      AND dismissed = false
    GROUP BY category
  ) t;

  RETURN jsonb_build_object(
    'total_users', v_total_users,
    'active_users_7d', v_active_users,
    'moments_today', v_moments_today,
    'avg_moments_per_active_user', round(v_avg_moments, 1),
    'manual_today', v_manual_today,
    'automatic_today', v_auto_today,
    'day7_retention', v_d7_retention,
    'category_distribution', v_cat_dist
  );
END;
$$;

-- Grant execute on functions to authenticated users
GRANT EXECUTE ON FUNCTION generate_weekly_witness(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_metrics() TO authenticated;