-- Migration: Remove non-functional requirements and type field from artifacts
-- Purpose: Clean up artifact schema by removing deprecated non-functional requirements
-- Affected: artifacts.artifact JSONB column
-- Note: This migration removes the type discrimination field and filters out non-functional requirements

BEGIN;

-- Step 1: Remove non-functional requirements from the requirements array
-- and remove the 'type' field from all remaining requirements
UPDATE "public"."artifacts"
SET "artifact" = jsonb_set(
    "artifact",
    '{requirement_analysis,requirements}',
    (
        SELECT jsonb_agg(
            -- Remove the 'type' field from each requirement
            requirement - 'type'
        )
        FROM jsonb_array_elements("artifact"->'requirement_analysis'->'requirements') AS requirement
        -- Filter out non-functional requirements (type = 'non_functional')
        WHERE requirement->>'type' != 'non_functional'
    )
)
WHERE "artifact" IS NOT NULL
  AND "artifact"->'requirement_analysis'->'requirements' IS NOT NULL;

-- Step 2: Handle cases where all requirements were non-functional (resulting in NULL)
-- Set to empty array instead of NULL
UPDATE "public"."artifacts"
SET "artifact" = jsonb_set(
    "artifact",
    '{requirement_analysis,requirements}',
    '[]'::jsonb
)
WHERE "artifact" IS NOT NULL
  AND "artifact"->'requirement_analysis' IS NOT NULL
  AND "artifact"->'requirement_analysis'->'requirements' IS NULL;

-- Step 3: Add a check constraint to ensure no new data with 'type' field is inserted
-- Note: This is commented out as it would prevent rollback.
-- Uncomment after confirming the migration is successful and the application code is updated.
-- ALTER TABLE "public"."artifacts"
-- ADD CONSTRAINT "artifacts_no_requirement_type_check"
-- CHECK (
--     NOT EXISTS (
--         SELECT 1
--         FROM jsonb_array_elements("artifact"->'requirement_analysis'->'requirements') AS requirement
--         WHERE requirement ? 'type'
--     )
-- );

-- Step 4: Log migration summary for verification
DO $$
DECLARE
    total_count INTEGER;
    updated_count INTEGER;
BEGIN
    -- Get total number of artifacts
    SELECT COUNT(*) INTO total_count FROM "public"."artifacts" WHERE "artifact" IS NOT NULL;

    -- Get number of artifacts that had requirements with type field
    SELECT COUNT(*) INTO updated_count
    FROM "public"."artifacts"
    WHERE "artifact" IS NOT NULL
      AND EXISTS (
          SELECT 1
          FROM jsonb_array_elements("artifact"->'requirement_analysis'->'requirements') AS requirement
          WHERE requirement ? 'type'
      );

    RAISE NOTICE 'Migration completed: % artifacts processed, % had type fields removed', total_count, updated_count;
END $$;

COMMIT;

-- Rollback instructions (if needed):
-- This migration is destructive for non-functional requirements and the type field.
-- To rollback:
-- 1. Restore from backup
-- 2. Or manually re-add type fields (though original non-functional requirements cannot be recovered)