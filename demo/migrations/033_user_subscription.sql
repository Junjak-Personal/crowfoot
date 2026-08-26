-- IAP subscription state + lifetime-cumulative quota tracking.
-- One row per auth user, auto-created via signup trigger.
-- Writes go through SECURITY DEFINER RPCs (quota) or service role (webhook).

CREATE TABLE IF NOT EXISTS user_subscription (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  is_pro boolean NOT NULL DEFAULT false,
  pro_purchased_at timestamptz,
  pro_product_id text,
  pro_transaction_id text,

  revenuecat_synced_at timestamptz,

  quiz_used int NOT NULL DEFAULT 0,
  ocr_used int NOT NULL DEFAULT 0,
  ai_used int NOT NULL DEFAULT 0,

  -- A quiz completion counts at most once per KST day.
  quiz_last_counted_date date,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_subscription ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own subscription" ON user_subscription;
CREATE POLICY "Users can read own subscription"
  ON user_subscription FOR SELECT
  USING (auth.uid() = user_id);
-- No INSERT/UPDATE/DELETE policy: writes only via trigger / RPC / service role.

-- ----------------------------------------------------------------------------
-- Signup trigger — auto-create subscription row for every new user.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION ensure_user_subscription_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_subscription (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;
CREATE TRIGGER on_auth_user_created_subscription
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION ensure_user_subscription_row();

-- Backfill existing users.
INSERT INTO user_subscription (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Quota increment RPCs (SECURITY DEFINER bypasses the write-block above).
-- All RPCs are no-op for Pro users so the client doesn't need to gate the call.
-- ----------------------------------------------------------------------------

-- Quiz: increment at most once per KST day per user.
CREATE OR REPLACE FUNCTION increment_quiz_used()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  today_kst date := (now() AT TIME ZONE 'Asia/Seoul')::date;
  result_row user_subscription;
  did_count boolean;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  UPDATE user_subscription
  SET quiz_used = quiz_used + 1,
      quiz_last_counted_date = today_kst,
      updated_at = now()
  WHERE user_id = uid
    AND is_pro = false
    AND (quiz_last_counted_date IS NULL OR quiz_last_counted_date < today_kst)
  RETURNING * INTO result_row;

  did_count := FOUND;

  IF NOT did_count THEN
    SELECT * INTO result_row FROM user_subscription WHERE user_id = uid;
  END IF;

  RETURN jsonb_build_object(
    'quiz_used', result_row.quiz_used,
    'is_pro', result_row.is_pro,
    'counted', did_count
  );
END;
$$;

-- OCR: increment per capture attempt (image count irrelevant).
CREATE OR REPLACE FUNCTION increment_ocr_used()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  result_row user_subscription;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  UPDATE user_subscription
  SET ocr_used = ocr_used + 1, updated_at = now()
  WHERE user_id = uid AND is_pro = false
  RETURNING * INTO result_row;

  IF NOT FOUND THEN
    SELECT * INTO result_row FROM user_subscription WHERE user_id = uid;
  END IF;

  RETURN jsonb_build_object(
    'ocr_used', result_row.ocr_used,
    'is_pro', result_row.is_pro
  );
END;
$$;

-- AI Assistant: increment per message.
CREATE OR REPLACE FUNCTION increment_ai_used()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  result_row user_subscription;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  UPDATE user_subscription
  SET ai_used = ai_used + 1, updated_at = now()
  WHERE user_id = uid AND is_pro = false
  RETURNING * INTO result_row;

  IF NOT FOUND THEN
    SELECT * INTO result_row FROM user_subscription WHERE user_id = uid;
  END IF;

  RETURN jsonb_build_object(
    'ai_used', result_row.ai_used,
    'is_pro', result_row.is_pro
  );
END;
$$;

GRANT EXECUTE ON FUNCTION increment_quiz_used() TO authenticated;
GRANT EXECUTE ON FUNCTION increment_ocr_used() TO authenticated;
GRANT EXECUTE ON FUNCTION increment_ai_used() TO authenticated;

-- ----------------------------------------------------------------------------
-- Server-side count enforcement (belt-and-suspenders alongside UI paywall).
-- Free tier: 1000 words, 5 wordbooks.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION enforce_free_word_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_is_pro boolean;
  word_count int;
BEGIN
  SELECT is_pro INTO user_is_pro
  FROM user_subscription WHERE user_id = NEW.user_id;

  IF user_is_pro IS TRUE THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO word_count FROM words WHERE user_id = NEW.user_id;
  IF word_count >= 1000 THEN
    RAISE EXCEPTION 'FREE_TIER_WORD_LIMIT_REACHED'
      USING HINT = '1000';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_free_word_limit_trigger ON words;
CREATE TRIGGER enforce_free_word_limit_trigger
  BEFORE INSERT ON words
  FOR EACH ROW EXECUTE FUNCTION enforce_free_word_limit();

CREATE OR REPLACE FUNCTION enforce_free_wordbook_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_is_pro boolean;
  wb_count int;
BEGIN
  SELECT is_pro INTO user_is_pro
  FROM user_subscription WHERE user_id = NEW.user_id;

  IF user_is_pro IS TRUE THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO wb_count FROM wordbooks WHERE user_id = NEW.user_id;
  IF wb_count >= 5 THEN
    RAISE EXCEPTION 'FREE_TIER_WORDBOOK_LIMIT_REACHED'
      USING HINT = '5';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_free_wordbook_limit_trigger ON wordbooks;
CREATE TRIGGER enforce_free_wordbook_limit_trigger
  BEFORE INSERT ON wordbooks
  FOR EACH ROW EXECUTE FUNCTION enforce_free_wordbook_limit();
