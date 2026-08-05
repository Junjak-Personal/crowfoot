// Modified from the original Liam ERD source (Apache-2.0, ROUTE06, Inc.).
// See the NOTICE file at the repository root for what changed.
import { useNodes } from '@xyflow/react'
import { useCallback, useMemo } from 'react'
import { useUserEditingOrThrow } from '../../../../../../stores'
import { useCustomReactflow } from '../../../../../reactflow/hooks'
import { isTableNode } from '../../../../utils'
import { updateNodesHiddenState } from '../../../ERDContent/utils'

type TableVisibilityStatus = 'all-hidden' | 'all-visible' | 'partially-visible'

export const useTableVisibility = () => {
  const nodes = useNodes()

  const visibilityStatus: TableVisibilityStatus = useMemo(() => {
    const tableNodes = nodes.filter((node) => isTableNode(node))
    const visibleTableNodes = tableNodes.filter((node) => !node.hidden)

    if (visibleTableNodes.length === 0) {
      return 'all-hidden'
    }
    if (visibleTableNodes.length === tableNodes.length) {
      return 'all-visible'
    }

    return 'partially-visible'
  }, [nodes])

  const { setHiddenNodeIds, resetSelectedNodeIds } = useUserEditingOrThrow()
  const { setNodes } = useCustomReactflow()

  const updateVisibility = useCallback(
    (hiddenNodeIds: string[]) => {
      const updatedNodes = updateNodesHiddenState({
        nodes,
        hiddenNodeIds: hiddenNodeIds,
        shouldHideGroupNodeId: true,
      })
      setNodes(updatedNodes)
      setHiddenNodeIds(hiddenNodeIds)
    },
    [nodes, setNodes, setHiddenNodeIds],
  )

  const showAllNodes = useCallback(() => {
    resetSelectedNodeIds()
    updateVisibility([])
  }, [resetSelectedNodeIds, updateVisibility])

  const hideAllNodes = useCallback(() => {
    resetSelectedNodeIds()
    // Scoped to table nodes only (F4): unfiltered, this pushed memo and
    // group node ids into `?hidden=` too, which also disagreed with this
    // control's own `aria-label="Hide All Tables"`.
    updateVisibility(nodes.filter(isTableNode).map((node) => node.id))
  }, [nodes, resetSelectedNodeIds, updateVisibility])

  return { visibilityStatus, showAllNodes, hideAllNodes }
}
