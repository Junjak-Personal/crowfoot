-- Remove validation_queries and validation_results tables and related infrastructure
-- These tables were used for QA agent query execution logging but are no longer needed
-- since we've migrated to LangGraph checkpointer for state persistence

-- First, remove foreign key constraint from timeline_items
ALTER TABLE "public"."timeline_items"
DROP CONSTRAINT IF EXISTS "timeline_items_query_result_id_fkey";

-- Drop column query_result_id from timeline_items
ALTER TABLE "public"."timeline_items"
DROP COLUMN IF EXISTS "query_result_id";

-- Drop validation_results table (must be done before validation_queries due to foreign key)
DROP TABLE IF EXISTS "public"."validation_results";

-- Drop validation_queries table
DROP TABLE IF EXISTS "public"."validation_queries";

-- Drop related functions
DROP FUNCTION IF EXISTS "public"."set_validation_queries_organization_id"();
DROP FUNCTION IF EXISTS "public"."set_validation_results_organization_id"();