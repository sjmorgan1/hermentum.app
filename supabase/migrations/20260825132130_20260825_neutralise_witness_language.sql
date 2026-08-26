-- Update weekly witness language to be more neutral (no performance judgement)
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
  v_cat_counts   jsonb;
  v_source_counts jsonb;
BEGIN
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

  SELECT count(DISTINCT date(timestamp)) INTO v_days_active
  FROM moments
  WHERE user_id = p_user_id
    AND dismissed = false
    AND timestamp >= p_week_start::timestamptz
    AND timestamp < (v_week_end + 1)::timestamptz;

  SELECT
    count(*) FILTER (WHERE source = 'manual'),
    count(*) FILTER (WHERE source != 'manual')
  INTO v_manual, v_auto
  FROM moments
  WHERE user_id = p_user_id
    AND dismissed = false
    AND timestamp >= p_week_start::timestamptz
    AND timestamp < (v_week_end + 1)::timestamptz;

  SELECT count(*) INTO v_for_me
  FROM moments
  WHERE user_id = p_user_id
    AND dismissed = false
    AND category = 'me'
    AND timestamp >= p_week_start::timestamptz
    AND timestamp < (v_week_end + 1)::timestamptz;

  SELECT count(*) INTO v_care
  FROM moments
  WHERE user_id = p_user_id
    AND dismissed = false
    AND category = 'care'
    AND timestamp >= p_week_start::timestamptz
    AND timestamp < (v_week_end + 1)::timestamptz;

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

  -- Neutral, factual language — no performance judgement
  v_summary := 'This week you recorded ' || v_total || ' moment' || CASE WHEN v_total != 1 THEN 's' ELSE '' END || '.';
  v_summary := v_summary || ' You recorded on ' || v_days_active || ' of 7 days.';

  IF v_care > 0 AND v_care >= v_total / 3 THEN
    v_summary := v_summary || ' ' || v_care || ' involved caring for someone else.';
  ELSIF v_for_me > 0 THEN
    v_summary := v_summary || ' ' || v_for_me || ' were things you did specifically for you.';
  ELSIF v_auto > 0 THEN
    v_summary := v_summary || ' ' || v_auto || ' were noticed automatically.';
  END IF;

  IF v_busiest_count IS NOT NULL AND v_busiest_count > 3 THEN
    v_summary := v_summary || ' ' || v_busiest_day || ' had the most activity.';
  END IF;

  INSERT INTO weekly_witnesses (user_id, week_start, week_end, summary, stats)
  VALUES (p_user_id, p_week_start, v_week_end, v_summary, v_stats)
  ON CONFLICT (user_id, week_start) DO UPDATE SET summary = EXCLUDED.summary, stats = EXCLUDED.stats;

  RETURN v_summary;
END;
$$;

GRANT EXECUTE ON FUNCTION generate_weekly_witness(uuid, date) TO authenticated;
