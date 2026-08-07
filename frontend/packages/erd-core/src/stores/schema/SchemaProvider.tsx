// Modified from the original Liam ERD source (Apache-2.0, ROUTE06, Inc.).
// See the NOTICE file at the repository root for what changed.
import {
  getMigrationOperations,
  mergeSchemas,
  type Schema,
  schemaSchema,
} from '@crowfoot/schema'
import { type FC, type PropsWithChildren, useMemo } from 'react'
import * as v from 'valibot'
import {
  applySchemaEdits,
  deserializeSchemaEdits,
} from '../../utils/schemaEdit'
import { useUserEditingOrThrow } from '../userEditing'
import { SchemaContext, type SchemaContextValue } from './context'

const schemaProviderSchema = v.object({
  current: schemaSchema,
  baseline: v.optional(schemaSchema),
})

export type SchemaProviderValue = v.InferOutput<typeof schemaProviderSchema>

type Props = PropsWithChildren & SchemaProviderValue

export const SchemaProvider: FC<Props> = ({ children, current, baseline }) => {
  const { schemaEdits } = useUserEditingOrThrow()

  /**
   * The viewer's edits are folded in here, at the one place every consumer
   * reads from: the canvas, the sidebar, the detail drawer, the command
   * palette and the DDL export all take `current` from this context, so an
   * edit reaches all of them — including the exported SQL — without any of
   * them knowing edits exist.
   */
  const edited = useMemo(
    () => applySchemaEdits(current, deserializeSchemaEdits(schemaEdits)),
    [current, schemaEdits],
  )

  const computedSchema: SchemaContextValue = useMemo(() => {
    const emptySchema: Schema = {
      tables: {},
      enums: {},
      extensions: {},
    }
    const operations = getMigrationOperations(baseline ?? emptySchema, edited)
    const merged = baseline ? mergeSchemas(baseline, edited) : edited

    return {
      current: edited,
      shipped: current,
      baseline,
      merged,
      operations,
    }
  }, [edited, current, baseline])

  return (
    <SchemaContext.Provider value={computedSchema}>
      {children}
    </SchemaContext.Provider>
  )
}
