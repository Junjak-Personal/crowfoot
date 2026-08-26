-- Per-user per-minute rate limit for cost-sensitive API routes.
-- Primary target: /api/dictionary (calls OpenAI on new-term translations).
-- Anonymous traffic is already blocked by the existing auth check on the route,
-- so user_id is sufficient as the rate-limit key.

CREATE TABLE IF NOT EXISTS api_rate_limits (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  route text NOT NULL,
  minute_bucket timestamptz NOT NULL,
  count int NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, route, minute_bucket)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_cleanup
  ON api_rate_limits (minute_bucket);

ALTER TABLE api_rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies — only the SECURITY DEFINER RPC writes here.

-- Atomic check + increment. Returns whether the call is allowed and the
-- current count for the bucket. The caller (API route) should return 429 when
-- allowed=false. The row is incremented regardless of allowed — that way a
-- caller hammering the endpoint stays blocked for the remainder of the
-- minute bucket instead of the count drifting back under the limit.
CREATE OR REPLACE FUNCTION check_and_increment_rate_limit(
  p_route text,
  p_max_per_minute int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  minute_now timestamptz := date_trunc('minute', now());
  new_count int;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  INSERT INTO api_rate_limits (user_id, route, minute_bucket, count)
  VALUES (uid, p_route, minute_now, 1)
  ON CONFLICT (user_id, route, minute_bucket)
  DO UPDATE SET count = api_rate_limits.count + 1
  RETURNING count INTO new_count;

  RETURN jsonb_build_object(
    'allowed', new_count <= p_max_per_minute,
    'count', new_count,
    'limit', p_max_per_minute
  );
END;
$$;

GRANT EXECUTE ON FUNCTION check_and_increment_rate_limit(text, int) TO authenticated;

-- Background cleanup. Keep one hour of history (enough for human debugging),
-- delete the rest. Bucket count stays bounded under any traffic level.
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.unschedule('cleanup-rate-limits')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-rate-limits');

SELECT cron.schedule(
  'cleanup-rate-limits',
  '*/30 * * * *',
  $$ DELETE FROM api_rate_limits WHERE minute_bucket < now() - interval '1 hour' $$
);
