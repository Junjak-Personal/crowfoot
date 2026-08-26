-- Survey becomes milestone-based: prompted at quiz_used = 3 / 7 / 30
-- (quiz counts at most once per KST day, so these are ~3 days / 1 week / 1 month
-- of active use). Up to one response per milestone → longitudinal signal on how
-- satisfaction and price intent shift as a user gets more engaged.
--
-- Also adds two targeted free-text columns (pain points, feature requests)
-- alongside the existing general comment.
--
-- Idempotent: guarded so re-running is a no-op.

-- 1. milestone column + value constraint.
ALTER TABLE feedback_survey ADD COLUMN IF NOT EXISTS milestone smallint;
UPDATE feedback_survey SET milestone = 3 WHERE milestone IS NULL;
ALTER TABLE feedback_survey ALTER COLUMN milestone SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feedback_survey_milestone_check') THEN
    ALTER TABLE feedback_survey
      ADD CONSTRAINT feedback_survey_milestone_check CHECK (milestone IN (3, 7, 30));
  END IF;
END $$;

-- 2. Switch PK (user_id) -> (user_id, milestone), only if still single-column.
DO $$
DECLARE
  pk_cols int;
BEGIN
  SELECT array_length(conkey, 1) INTO pk_cols
  FROM pg_constraint
  WHERE conrelid = 'public.feedback_survey'::regclass AND contype = 'p';

  IF pk_cols = 1 THEN
    ALTER TABLE feedback_survey DROP CONSTRAINT feedback_survey_pkey;
    ALTER TABLE feedback_survey ADD PRIMARY KEY (user_id, milestone);
  END IF;
END $$;

-- 3. Targeted free-text columns.
ALTER TABLE feedback_survey ADD COLUMN IF NOT EXISTS pain_points text;
ALTER TABLE feedback_survey ADD COLUMN IF NOT EXISTS feature_requests text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feedback_survey_pain_points_check') THEN
    ALTER TABLE feedback_survey
      ADD CONSTRAINT feedback_survey_pain_points_check CHECK (char_length(pain_points) <= 2000);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feedback_survey_feature_requests_check') THEN
    ALTER TABLE feedback_survey
      ADD CONSTRAINT feedback_survey_feature_requests_check CHECK (char_length(feature_requests) <= 2000);
  END IF;
END $$;
