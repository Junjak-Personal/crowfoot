// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import { type Node, useReactFlow } from '@xyflow/react'
import { useCallback } from 'react'
import { useVersionOrThrow } from '../../../../providers'
import { useUserEditingOrThrow } from '../../../../stores'
import { repositionTableLogEvent } from '../../../gtm/utils/repositionTableLogEvent'
import {
  deserializeTableLayout,
  isTableNode,
  pruneToBaseLayout,
  rememberTablePositions,
  serializeTableLayout,
} from '../../utils'

/**
 * Persists moved tables to `?positions=`.
 *
 * Two gestures write positions — React Flow's own node drag and the group
 * label drag — and the merge below is the part that must not diverge between
 * them: the incoming `?positions=` is spread in *first* so table positions a
 * shared link carried survive a local drag of unrelated tables. Copying that
 * rule to a second call site would leave one of them to be fixed alone.
 *
 * Callers pass whatever the gesture moved; non-table nodes are dropped here so
 * a mixed selection (memos travel with tables) needs no filtering of its own.
 */
export const useCommitTablePositions = () => {
  const { tablePositions, setTablePositions } = useUserEditingOrThrow()
  const { version } = useVersionOrThrow()
  // A dragged table's position is measured from its parent, and the parent is
  // only findable in the whole list.
  const { getNodes } = useReactFlow()

  return useCallback(
    (moved: Node[]) => {
      const tables = moved.filter(isTableNode)
      if (tables.length === 0) return

      setTablePositions(
        serializeTableLayout(
          pruneToBaseLayout({
            ...deserializeTableLayout(tablePositions),
            ...rememberTablePositions(tables, getNodes()),
          }),
        ),
      )

      const operationId = `id_${Date.now()}`
      for (const node of tables) {
        repositionTableLogEvent({
          tableId: node.id,
          operationId,
          platform: version.displayedOn,
          gitHash: version.gitHash,
          ver: version.version,
          appEnv: version.envName,
        })
      }
    },
    [tablePositions, setTablePositions, version, getNodes],
  )
}
