import * as v from 'valibot'
import type { Json, Tables } from '../supabase/database.types'

export const jsonSchema: v.GenericSchema<Json> = v.lazy(() =>
  v.union([
    v.string(),
    v.number(),
    v.boolean(),
    v.null(),
    v.record(v.string(), v.optional(jsonSchema)),
    v.array(jsonSchema),
  ]),
)

export const buildingSchemaVersionsSchema: v.GenericSchema<
  Tables<'building_schema_versions'>
> = v.object({
  id: v.pipe(v.string(), v.uuid()),
  number: v.number(),
  building_schema_id: v.pipe(v.string(), v.uuid()),
  patch: v.nullable(jsonSchema),
  created_at: v.string(),
  organization_id: v.pipe(v.string(), v.uuid()),
  reverse_patch: v.nullable(jsonSchema),
})
