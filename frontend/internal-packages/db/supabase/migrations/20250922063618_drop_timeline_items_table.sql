/*
 * Comprehensive timeline_items cleanup migration
 *
 * Purpose: Remove all timeline_items related elements from the database schema.
 *          The system has migrated to LangGraph checkpoints for message and state persistence.
 *
 * Background: The timeline_items table was previously used to store user messages,
 *             assistant responses, and schema version changes. This functionality
 *             has been replaced by the LangGraph checkpoints system which provides
 *             better state management and persistence capabilities.
 *
 * Affected elements:
 *   - timeline_items table (dropped)
 *   - timeline_item_type_enum enum type (removed)
 *   - set_timeline_items_organization_id() function (removed)
 *   - update_building_schema() function (updated to remove timeline_items references)
 *
 * Special considerations:
 *   - This is a destructive operation that removes all timeline data
 *   - The application has already been updated to use LangGraph checkpoints
 *   - No data migration is needed as the new system is independent
 *   - RLS policies will be automatically removed with the table
 *   - The update_building_schema function is updated to maintain building schema functionality
 */

begin;

-- Drop the timeline_items table if it exists
-- This removes all legacy message and timeline data as the system
-- has migrated to LangGraph checkpoints for state persistence
drop table if exists "public"."timeline_items";

-- Remove the timeline_item_type_enum enum type
-- This enum was only used by the timeline_items table
drop type if exists "public"."timeline_item_type_enum";

-- Remove the set_timeline_items_organization_id trigger function
-- This function was only used by the timeline_items table
drop function if exists "public"."set_timeline_items_organization_id"();

-- Update the update_building_schema function to remove timeline_items references
-- This maintains all building schema functionality while removing timeline_items dependencies
create or replace function "public"."update_building_schema"("p_schema_id" "uuid", "p_schema_schema" "jsonb", "p_schema_version_patch" "jsonb", "p_schema_version_reverse_patch" "jsonb", "p_latest_schema_version_number" integer, "p_message_content" "text") returns "jsonb"
    language "plpgsql" security definer
    as $$
declare
  v_new_version_id uuid;
  v_design_session_id uuid;
  v_organization_id uuid;
  v_new_version_number integer;
  v_actual_latest_version_number integer;
begin
  -- Get the latest version number
  select coalesce(max(number), 0) into v_actual_latest_version_number
  from building_schema_versions
  where building_schema_id = p_schema_id;

  -- Check for version conflict
  if v_actual_latest_version_number != p_latest_schema_version_number then
    return jsonb_build_object(
      'success', false,
      'error', 'VERSION_CONFLICT',
      'message', format('Version conflict: expected version %s but current version is %s',
                       p_latest_schema_version_number, v_actual_latest_version_number)
    );
  end if;

  -- Get design_session_id and organization_id
  select design_session_id, organization_id
  into v_design_session_id, v_organization_id
  from building_schemas
  where id = p_schema_id;

  if v_design_session_id is null then
    return jsonb_build_object(
      'success', false,
      'error', 'SCHEMA_NOT_FOUND',
      'message', 'Building schema not found'
    );
  end if;

  -- Update the schema
  update building_schemas
  set schema = p_schema_schema
  where id = p_schema_id;

  -- Create new version
  v_new_version_number := v_actual_latest_version_number + 1;
  insert into building_schema_versions (
    building_schema_id,
    number,
    patch,
    reverse_patch,
    organization_id
  ) values (
    p_schema_id,
    v_new_version_number,
    p_schema_version_patch,
    p_schema_version_reverse_patch,
    v_organization_id
  ) returning id into v_new_version_id;

  -- Return success with version ID
  return jsonb_build_object(
    'success', true,
    'versionId', v_new_version_id
  );
end;
$$;

alter function "public"."update_building_schema"("p_schema_id" "uuid", "p_schema_schema" "jsonb", "p_schema_version_patch" "jsonb", "p_schema_version_reverse_patch" "jsonb", "p_latest_schema_version_number" integer, "p_message_content" "text") owner to "postgres";

commit;