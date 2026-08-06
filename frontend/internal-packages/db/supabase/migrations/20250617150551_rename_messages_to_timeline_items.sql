BEGIN;

-- Step 1: Create new enum type
CREATE TYPE "public"."timeline_item_type_enum" AS ENUM (
    'user',
    'assistant',
    'schema_version',
    'error'
);

ALTER TYPE "public"."timeline_item_type_enum" OWNER TO "postgres";

-- Step 2: Rename the table
ALTER TABLE "public"."messages" RENAME TO "timeline_items";

-- Step 3: Add new column with new enum type
ALTER TABLE "public"."timeline_items" ADD COLUMN "type" "public"."timeline_item_type_enum";

-- Step 4: Populate new column based on old role column
UPDATE "public"."timeline_items" 
SET "type" = "role"::text::"public"."timeline_item_type_enum";

-- Step 5: Make new column NOT NULL
ALTER TABLE "public"."timeline_items" ALTER COLUMN "type" SET NOT NULL;

-- Step 6: Drop old role column
ALTER TABLE "public"."timeline_items" DROP COLUMN "role";

-- Step 7: Update all constraints
ALTER TABLE "public"."timeline_items" RENAME CONSTRAINT "messages_pkey" TO "timeline_items_pkey";
ALTER TABLE "public"."timeline_items" RENAME CONSTRAINT "messages_design_session_id_fkey" TO "timeline_items_design_session_id_fkey";
ALTER TABLE "public"."timeline_items" RENAME CONSTRAINT "messages_user_id_fkey" TO "timeline_items_user_id_fkey";
ALTER TABLE "public"."timeline_items" RENAME CONSTRAINT "messages_organization_id_fkey" TO "timeline_items_organization_id_fkey";
ALTER TABLE "public"."timeline_items" RENAME CONSTRAINT "messages_building_schema_version_id_fkey" TO "timeline_items_building_schema_version_id_fkey";

-- Step 8: Update indexes (ignore errors if they don't exist)
ALTER INDEX IF EXISTS "public"."messages_building_schema_version_id_idx" RENAME TO "timeline_items_building_schema_version_id_idx";
ALTER INDEX IF EXISTS "public"."messages_schema_version_role_idx" RENAME TO "timeline_items_schema_version_type_idx";
ALTER INDEX IF EXISTS "public"."idx_messages_design_session_id" RENAME TO "idx_timeline_items_design_session_id";
ALTER INDEX IF EXISTS "public"."idx_messages_created_at" RENAME TO "idx_timeline_items_created_at";

-- Step 9: Drop and recreate the partial index with correct condition
DROP INDEX IF EXISTS "public"."timeline_items_schema_version_type_idx";
CREATE INDEX "timeline_items_schema_version_type_idx" ON "public"."timeline_items" ("design_session_id", "created_at") 
WHERE "type" = 'schema_version';

-- Step 10: Update trigger function
DROP TRIGGER IF EXISTS "set_messages_organization_id_trigger" ON "public"."timeline_items";

CREATE OR REPLACE FUNCTION "public"."set_timeline_items_organization_id"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  NEW.organization_id := (
    SELECT "organization_id" 
    FROM "public"."design_sessions" 
    WHERE "id" = NEW.design_session_id
  );
  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."set_timeline_items_organization_id"() OWNER TO "postgres";

CREATE TRIGGER "set_timeline_items_organization_id_trigger"
  BEFORE INSERT OR UPDATE ON "public"."timeline_items"
  FOR EACH ROW
  EXECUTE FUNCTION "public"."set_timeline_items_organization_id"();

-- Step 11: Drop old function
DROP FUNCTION IF EXISTS "public"."set_messages_organization_id"();

-- Step 12: Update RLS policies
-- Drop old policies
DROP POLICY IF EXISTS "authenticated_users_can_select_org_messages" ON "public"."timeline_items";
DROP POLICY IF EXISTS "authenticated_users_can_insert_org_messages" ON "public"."timeline_items";
DROP POLICY IF EXISTS "authenticated_users_can_update_org_messages" ON "public"."timeline_items";
DROP POLICY IF EXISTS "service_role_can_select_all_messages" ON "public"."timeline_items";
DROP POLICY IF EXISTS "service_role_can_insert_all_messages" ON "public"."timeline_items";
DROP POLICY IF EXISTS "service_role_can_update_all_messages" ON "public"."timeline_items";

-- Create new policies
CREATE POLICY "authenticated_users_can_select_org_timeline_items" 
  ON "public"."timeline_items" 
  FOR SELECT TO "authenticated" 
  USING (("organization_id" IN ( 
    SELECT "organization_members"."organization_id"
    FROM "public"."organization_members"
    WHERE ("organization_members"."user_id" = "auth"."uid"())
  )));

COMMENT ON POLICY "authenticated_users_can_select_org_timeline_items" 
  ON "public"."timeline_items" 
  IS 'Authenticated users can only view timeline items belonging to organizations they are members of';

CREATE POLICY "authenticated_users_can_insert_org_timeline_items" 
  ON "public"."timeline_items" 
  FOR INSERT TO "authenticated" 
  WITH CHECK (("organization_id" IN ( 
    SELECT "organization_members"."organization_id"
    FROM "public"."organization_members"
    WHERE ("organization_members"."user_id" = "auth"."uid"())
  )));

COMMENT ON POLICY "authenticated_users_can_insert_org_timeline_items" 
  ON "public"."timeline_items" 
  IS 'Authenticated users can only create timeline items in organizations they are members of';

CREATE POLICY "authenticated_users_can_update_org_timeline_items" 
  ON "public"."timeline_items" 
  FOR UPDATE TO "authenticated" 
  USING (("organization_id" IN ( 
    SELECT "organization_members"."organization_id"
    FROM "public"."organization_members"
    WHERE ("organization_members"."user_id" = "auth"."uid"())
  ))) 
  WITH CHECK (("organization_id" IN ( 
    SELECT "organization_members"."organization_id"
    FROM "public"."organization_members"
    WHERE ("organization_members"."user_id" = "auth"."uid"())
  )));

COMMENT ON POLICY "authenticated_users_can_update_org_timeline_items" 
  ON "public"."timeline_items" 
  IS 'Authenticated users can only update timeline items in organizations they are members of';

CREATE POLICY "service_role_can_select_all_timeline_items" 
  ON "public"."timeline_items" 
  FOR SELECT TO "service_role" 
  USING (true);

CREATE POLICY "service_role_can_insert_all_timeline_items" 
  ON "public"."timeline_items" 
  FOR INSERT TO "service_role" 
  WITH CHECK (true);

CREATE POLICY "service_role_can_update_all_timeline_items" 
  ON "public"."timeline_items" 
  FOR UPDATE TO "service_role" 
  USING (true) 
  WITH CHECK (true);

-- Step 13: Update function grants
GRANT ALL ON FUNCTION "public"."set_timeline_items_organization_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_timeline_items_organization_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_timeline_items_organization_id"() TO "service_role";

-- Step 14: Update the update_building_schema function to use timeline_items
CREATE OR REPLACE FUNCTION "public"."update_building_schema"(
  "p_schema_id" "uuid",
  "p_schema_schema" "jsonb",
  "p_schema_version_patch" "jsonb",
  "p_schema_version_reverse_patch" "jsonb",
  "p_latest_schema_version_number" integer,
  "p_message_content" "text"
) RETURNS "jsonb"
LANGUAGE "plpgsql" SECURITY DEFINER
AS $function$
DECLARE
  v_new_version_id uuid;
  v_new_message_id uuid;
  v_design_session_id uuid;
  v_organization_id uuid;
  v_new_version_number integer;
  v_actual_latest_version_number integer;
BEGIN
  -- Get the latest version number
  SELECT COALESCE(MAX(number), 0) INTO v_actual_latest_version_number
  FROM building_schema_versions
  WHERE building_schema_id = p_schema_id;

  -- Check for version conflict
  IF v_actual_latest_version_number != p_latest_schema_version_number THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'VERSION_CONFLICT',
      'message', format('Version conflict: expected version %s but current version is %s', 
                       p_latest_schema_version_number, v_actual_latest_version_number)
    );
  END IF;

  -- Get design_session_id and organization_id
  SELECT design_session_id, organization_id 
  INTO v_design_session_id, v_organization_id
  FROM building_schemas
  WHERE id = p_schema_id;

  IF v_design_session_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'SCHEMA_NOT_FOUND',
      'message', 'Building schema not found'
    );
  END IF;

  -- Update the schema
  UPDATE building_schemas
  SET schema = p_schema_schema
  WHERE id = p_schema_id;

  -- Create new version
  v_new_version_number := v_actual_latest_version_number + 1;
  INSERT INTO building_schema_versions (
    building_schema_id,
    number,
    patch,
    reverse_patch,
    organization_id
  ) VALUES (
    p_schema_id,
    v_new_version_number,
    p_schema_version_patch,
    p_schema_version_reverse_patch,
    v_organization_id
  ) RETURNING id INTO v_new_version_id;

  -- Create schema_version message in timeline_items
  INSERT INTO timeline_items (
    design_session_id,
    type,
    content,
    building_schema_version_id,
    organization_id,
    updated_at
  ) VALUES (
    v_design_session_id,
    'schema_version',
    p_message_content,
    v_new_version_id,
    v_organization_id,
    CURRENT_TIMESTAMP
  ) RETURNING id INTO v_new_message_id;

  RETURN jsonb_build_object(
    'success', true,
    'versionId', v_new_version_id,
    'messageId', v_new_message_id
  );
END;
$function$;

-- Step 15: Drop the old enum type
DROP TYPE "public"."message_role_enum";

-- Step 16: Update realtime publication
-- Note: Realtime publication is automatically updated when table is renamed

COMMIT;