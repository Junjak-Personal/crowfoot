begin;

-- Drop the old 5-parameter version of update_building_schema
-- This resolves the function overload conflict that causes 404 errors in Supabase REST API
DROP FUNCTION IF EXISTS public.update_building_schema(
  p_schema_id uuid,
  p_schema_schema jsonb,
  p_schema_version_patch jsonb,
  p_schema_version_reverse_patch jsonb,
  p_latest_schema_version_number integer
);

-- The 6-parameter version with p_message_content should remain
-- (Already created in migration 20250613164943_revert_to_message_content_param.sql)

commit;
