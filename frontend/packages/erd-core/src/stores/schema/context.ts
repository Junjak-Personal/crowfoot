import { migrationOperationsSchema, schemaSchema } from '@crowfoot/schema'
import { createContext } from 'react'
import * as v from 'valibot'

const schemaStoreSchema = v.object({
  current: schemaSchema,
  /**
   * `current` before the viewer's `?schemaedits=` were folded in — what the
   * build shipped. Only the editing hook needs it, to work out the smallest
   * set of edits that reproduces what is on screen.
   */
  shipped: schemaSchema,
  baseline: v.optional(schemaSchema),
  merged: v.optional(schemaSchema),
  operations: v.optional(migrationOperationsSchema),
})

export type SchemaContextValue = v.InferOutput<typeof schemaStoreSchema>

export const SchemaContext = createContext<SchemaContextValue | null>(null)
