-- Preview feedback survey. One response per user (upsert on user_id).
-- Informs the future paid-conversion decision: per-feature satisfaction,
-- purchase intent, fair-price bucket, and acceptance at the ₩6,500/$4.99 point.
--
-- Unlike user_subscription (writes via RPC / service role only), users write
-- their OWN survey row directly — RLS + CHECK constraints bound every value, so
-- no SECURITY DEFINER layer is needed.

CREATE TABLE IF NOT EXISTS feedback_survey (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Per-feature satisfaction, 1..5, NULL = "haven't used / skipped".
  sat_words      smallint CHECK (sat_words      BETWEEN 1 AND 5),
  sat_wordbooks  smallint CHECK (sat_wordbooks  BETWEEN 1 AND 5),
  sat_ocr        smallint CHECK (sat_ocr        BETWEEN 1 AND 5),
  sat_assistant  smallint CHECK (sat_assistant  BETWEEN 1 AND 5),
  sat_quiz       smallint CHECK (sat_quiz       BETWEEN 1 AND 5),

  comment text CHECK (char_length(comment) <= 2000),

  -- Would buy if it went paid.
  purchase_intent  text CHECK (purchase_intent IN ('yes', 'maybe', 'no')),
  -- Fair-price bucket.
  price_bucket     text CHECK (price_bucket IN ('free', 'lt2500', 'lt5000', 'lt7000', 'gte7000')),
  -- Would buy at ₩6,500 / $4.99.
  price_499_intent text CHECK (price_499_intent IN ('yes', 'maybe', 'no')),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE feedback_survey ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own survey" ON feedback_survey;
CREATE POLICY "Users can read own survey"
  ON feedback_survey FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own survey" ON feedback_survey;
CREATE POLICY "Users can insert own survey"
  ON feedback_survey FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own survey" ON feedback_survey;
CREATE POLICY "Users can update own survey"
  ON feedback_survey FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
