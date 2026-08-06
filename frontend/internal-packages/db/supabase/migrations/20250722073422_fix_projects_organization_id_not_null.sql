BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.projects 
    WHERE organization_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Found projects with NULL organization_id. Please fix data before applying this migration.';
  END IF;
END $$;

ALTER TABLE public.projects 
ALTER COLUMN organization_id SET NOT NULL;

COMMIT;
