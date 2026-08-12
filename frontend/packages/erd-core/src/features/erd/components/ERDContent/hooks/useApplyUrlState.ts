// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import { type Node, useReactFlow } from '@xyflow/react'
import { useCallback } from 'react'
import {
  applyTableLayout,
  deserializeGroups,
  deserializeMemos,
  deserializeTableColors,
  deserializeTableLayout,
  getEffectiveGroups,
  getEffectiveMemos,
  getEffectiveTableLayout,
  highlightNodesAndEdges,
  isMemoNode,
  isTableGroupNode,
  memoNodesFrom,
  readEditParam,
  readEditParamList,
  readPlainParam,
  resolveTableColor,
  tableGroupNodesFrom,
} from '../../../utils'
import { hasNonRelatedChildNodes, updateNodesHiddenState } from '../utils'

/**
 * Rebuilds the canvas from the query string.
 *
 * The inverse of every commit, and the same derivation the canvas already ran
 * once at mount — pulled out so it can be run again. That is what makes the
 * back button an undo: the link is the whole of the diagram's state, so
 * restoring a previous URL restores a previous diagram, with no separate
 * history of edits to keep in step.
 *
 * It reads `location.search` rather than the store. The browser has already
 * moved the address bar by the time a `popstate` handler runs, while the
 * store's copy arrives a render later — reading the store rebuilt the canvas
 * from the state being navigated *away* from, which looked exactly like the
 * back button doing nothing.
 *
 * Positions are re-applied rather than recomputed. Running the automatic
 * layout here — which is what the popstate path used to do — would rearrange
 * the diagram in the middle of an undo, which is not an undo.
 *
 * `?schemaedits=` is absent on purpose: `SchemaProvider` derives the current
 * schema from it and `useSchemaNodeSync` reconciles the table nodes when that
 * changes, so doing it here as well would fight it.
 */
export const useApplyUrlState = () => {
  const { getNodes, setNodes, getEdges, setEdges } = useReactFlow()

  return useCallback(() => {
    const layout = getEffectiveTableLayout(
      deserializeTableLayout(readEditParamList('positions')),
    )
    const urlColors = deserializeTableColors(readEditParamList('colors'))
    const activeTableName = readPlainParam('active')

    // Everything that is not derived from a parameter is carried over as it
    // is: table nodes and, when the schema has any, the group the viewer makes
    // for tables with no relationship.
    const kept = getNodes().filter(
      (node) => !isMemoNode(node) && !isTableGroupNode(node),
    )

    const tables: Node[] = applyTableLayout(kept, layout).map((node) => ({
      ...node,
      data: {
        ...node.data,
        color: resolveTableColor(node.id, layout, urlColors),
      },
    }))

    // Group boxes first, then tables, then memos — the order the canvas is
    // built in at mount, and the one their z-indexes assume.
    const rebuilt: Node[] = [
      ...tableGroupNodesFrom(
        getEffectiveGroups(deserializeGroups(readEditParam('groups'))),
      ),
      ...tables,
      ...memoNodesFrom(
        getEffectiveMemos(deserializeMemos(readEditParam('memos'))),
      ),
    ]

    const visible = updateNodesHiddenState({
      nodes: rebuilt,
      hiddenNodeIds: readEditParamList('hidden'),
      shouldHideGroupNodeId: !hasNonRelatedChildNodes(rebuilt),
    })

    const { nodes, edges } = highlightNodesAndEdges(visible, getEdges(), {
      activeTableName: activeTableName === '' ? undefined : activeTableName,
    })

    setNodes(nodes)
    setEdges(edges)
  }, [getNodes, setNodes, getEdges, setEdges])
}
