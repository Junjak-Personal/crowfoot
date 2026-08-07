// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import type { Schema } from '@crowfoot/schema'
import { useCallback } from 'react'
import { useSchemaOrThrow, useUserEditingOrThrow } from '../../../../stores'
import {
  diffSchemaEdits,
  renameTable as renameTableInSchema,
  serializeSchemaEdits,
} from '../../../../utils/schemaEdit'
import { isTableGroupNode, renameTableInLayout } from '../../utils'
import { useGroupNodes } from '../useGroupNodes'

/**
 * The one way to change the schema from the UI.
 *
 * Callers hand over a whole next schema — usually built with the helpers in
 * `utils/schemaEdit` — and this works out the smallest set of edits that
 * reproduces it against what the build shipped, then writes that to
 * `?schemaedits=`. Editing a table back to its original shape therefore drops
 * it out of the URL again, the same way `?positions=` only carries tables that
 * are actually somewhere other than where the layout put them.
 *
 * Returns whether the edit went through: the structural helpers answer `null`
 * for a rename to a name that is already taken, and the caller has to tell the
 * user rather than let the field silently snap back.
 */
export const useSchemaEditing = () => {
  const { current, shipped } = useSchemaOrThrow()
  const {
    setSchemaEdits,
    tablePositions,
    setTablePositions,
    tableColors,
    setTableColors,
  } = useUserEditingOrThrow()
  const { commitGroups } = useGroupNodes()

  const commit = useCallback(
    (edit: (schema: Schema) => Schema | null): boolean => {
      const next = edit(current)
      if (next === null) return false

      const serialized = serializeSchemaEdits(diffSchemaEdits(shipped, next))
      // `null` drops the parameter entirely rather than leaving `?schemaedits=`
      // hanging off every link once the edits are undone.
      setSchemaEdits(serialized === '' ? null : serialized)
      return true
    },
    [current, shipped, setSchemaEdits],
  )

  /**
   * A table's name is its key in four separate stores, not just in the schema:
   * `?positions=`, `?colors=`, the groups that list it as a member, and the
   * browser-storage copies of all of those. Renaming only the schema leaves
   * the table pinned nowhere, untinted and outside every group it belonged to
   * — and none of that shows until the next reload, so it reads as the rename
   * having quietly eaten them.
   *
   * nuqs batches the query writes below into one history entry, so this lands
   * as a single change however many parameters it touches.
   */
  const renameTable = useCallback(
    (from: string, to: string): boolean => {
      if (!commit((schema) => renameTableInSchema(schema, from, to))) {
        return false
      }

      const renamed = renameTableInLayout(from, to, {
        positions: tablePositions,
        colors: tableColors,
      })
      setTablePositions(renamed.positions)
      setTableColors(renamed.colors)

      // Group membership lives in the canvas nodes; `commitGroups` mirrors the
      // result into browser storage and `?groups=` the way every other group
      // edit does.
      commitGroups((nodes) =>
        nodes.map((node) =>
          isTableGroupNode(node) && node.data.tableNames.includes(from)
            ? {
                ...node,
                data: {
                  ...node.data,
                  tableNames: node.data.tableNames.map((name) =>
                    name === from ? to : name,
                  ),
                },
              }
            : node,
        ),
      )

      return true
    },
    [
      commit,
      tablePositions,
      setTablePositions,
      tableColors,
      setTableColors,
      commitGroups,
    ],
  )

  const reset = useCallback(() => {
    setSchemaEdits(null)
  }, [setSchemaEdits])

  return { schema: current, commit, renameTable, reset }
}
