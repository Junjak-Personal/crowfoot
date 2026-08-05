// Added in erdkit; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import type { Node } from '@xyflow/react'
import { useCallback } from 'react'
import { useVersionOrThrow } from '../../../../providers'
import { useUserEditingOrThrow } from '../../../../stores'
import { repositionTableLogEvent } from '../../../gtm/utils/repositionTableLogEvent'
import {
  deserializeTableLayout,
  isTableNode,
  rememberTablePositions,
  serializeTableLayout,
} from '../../utils'

/**
 * Persists moved tables to browser storage and `?positions=`.
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

  return useCallback(
    (moved: Node[]) => {
      const tables = moved.filter(isTableNode)
      if (tables.length === 0) return

      const stored = rememberTablePositions(tables)
      setTablePositions(
        serializeTableLayout({
          ...deserializeTableLayout(tablePositions),
          ...stored,
        }),
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
    [tablePositions, setTablePositions, version],
  )
}
