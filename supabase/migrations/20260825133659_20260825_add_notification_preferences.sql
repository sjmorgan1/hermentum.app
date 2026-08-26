-- Add notification preferences to user_preferences
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS notification_level text DEFAULT 'low' CHECK (notification_level IN ('off', 'low', 'normal')),
  ADD COLUMN IF NOT EXISTS last_notified_at timestamptz;
