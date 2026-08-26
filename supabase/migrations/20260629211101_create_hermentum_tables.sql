
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL UNIQUE,
  name text NOT NULL,
  life jsonb DEFAULT '[]',
  struggle jsonb DEFAULT '[]',
  apps jsonb DEFAULT '[]',
  data_permissions jsonb DEFAULT '[]',
  goal text,
  notifications text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_profile" ON user_profiles FOR SELECT
  TO anon, authenticated USING (true);
CREATE POLICY "insert_own_profile" ON user_profiles FOR INSERT
  TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_own_profile" ON user_profiles FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_own_profile" ON user_profiles FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS daily_wins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  win_id integer NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (session_id, win_id, date)
);

ALTER TABLE daily_wins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_wins" ON daily_wins FOR SELECT
  TO anon, authenticated USING (true);
CREATE POLICY "insert_own_wins" ON daily_wins FOR INSERT
  TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_own_wins" ON daily_wins FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_own_wins" ON daily_wins FOR DELETE
  TO anon, authenticated USING (true);
