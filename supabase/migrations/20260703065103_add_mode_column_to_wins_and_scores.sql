/*
# Add mode column to daily_wins and user_scores

## Summary
Adds a `mode` column to both `daily_wins` and `user_scores` to support
multiple scoring modes within the same app (e.g. 'hermentum' vs 'mumentum').
Updates unique constraints to include mode so each mode tracks independently.

## Changes

### daily_wins
- Added: mode text NOT NULL DEFAULT 'hermentum'
- Dropped: UNIQUE(user_id, win_id, date) — did not include mode
- Added: UNIQUE(user_id, mode, win_id, date) — so each mode has its own win set

### user_scores
- Added: mode text NOT NULL DEFAULT 'hermentum'
- Dropped: UNIQUE(user_id, date) — did not include mode
- Added: UNIQUE(user_id, mode, date) — one score row per user per mode per day
*/

-- ─── daily_wins ───────────────────────────────────────────────────────────────

ALTER TABLE daily_wins ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'hermentum';

ALTER TABLE daily_wins DROP CONSTRAINT IF EXISTS daily_wins_user_win_date_key;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'daily_wins_user_mode_win_date_key'
    AND conrelid = 'daily_wins'::regclass
  ) THEN
    ALTER TABLE daily_wins ADD CONSTRAINT daily_wins_user_mode_win_date_key
      UNIQUE (user_id, mode, win_id, date);
  END IF;
END $$;

-- ─── user_scores ─────────────────────────────────────────────────────────────

ALTER TABLE user_scores ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'hermentum';

ALTER TABLE user_scores DROP CONSTRAINT IF EXISTS user_scores_user_id_date_key;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_scores_user_mode_date_key'
    AND conrelid = 'user_scores'::regclass
  ) THEN
    ALTER TABLE user_scores ADD CONSTRAINT user_scores_user_mode_date_key
      UNIQUE (user_id, mode, date);
  END IF;
END $$;
