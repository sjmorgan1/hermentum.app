
CREATE TABLE IF NOT EXISTS waitlist_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE waitlist_signups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "insert_waitlist" ON waitlist_signups FOR INSERT
  TO anon, authenticated WITH CHECK (true);
CREATE POLICY "select_waitlist" ON waitlist_signups FOR SELECT
  TO anon, authenticated USING (true);
CREATE POLICY "update_waitlist" ON waitlist_signups FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_waitlist" ON waitlist_signups FOR DELETE
  TO anon, authenticated USING (true);
