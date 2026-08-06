-- Drop the redundant query_results column from timeline_items table
-- The data is already stored in validation_results table and can be accessed via query_result_id
ALTER TABLE "public"."timeline_items" DROP COLUMN IF EXISTS "query_results";