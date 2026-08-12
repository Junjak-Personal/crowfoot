import { useCallback } from 'react'
import { useUserEditingOrThrow } from '../../../../stores'
import { useCustomReactflow } from '../../../reactflow/hooks'
import type { DisplayArea } from '../../types'
import { highlightNodesAndEdges } from '../../utils'

type SelectTableParams = {
  tableId: string
  displayArea: DisplayArea
}

export const useTableSelection = () => {
  const { setActiveTableName } = useUserEditingOrThrow()

  const { getNodes, getEdges, setNodes, setEdges, fitView } =
    useCustomReactflow()

  /**
   * Opens a table in the drawer and highlights what it touches. The camera does
   * not move: this is what a click on the canvas runs, and a table you just
   * clicked is one you were already looking at — framing it there yanks the
   * view away from whatever else you had in front of you. Use `revealTable`
   * when the table was picked from somewhere the canvas is not showing.
   */
  const selectTable = useCallback(
    ({ tableId }: SelectTableParams) => {
      setActiveTableName(tableId)

      const { nodes, edges } = highlightNodesAndEdges(getNodes(), getEdges(), {
        activeTableName: tableId,
      })

      setNodes(nodes)
      setEdges(edges)
    },
    [getNodes, getEdges, setNodes, setEdges, setActiveTableName],
  )

  /**
   * The same, and brings the table into view. For the sidebar list and the
   * command palette, where the table was chosen by name and may be anywhere.
   */
  const revealTable = useCallback(
    async ({ tableId, displayArea }: SelectTableParams) => {
      selectTable({ tableId, displayArea })

      if (displayArea === 'main') {
        await fitView({
          maxZoom: 1,
          duration: 300,
          nodes: [{ id: tableId }],
        })
      }
    },
    [selectTable, fitView],
  )

  const deselectTable = useCallback(() => {
    setActiveTableName(null)

    const { nodes, edges } = highlightNodesAndEdges(getNodes(), getEdges(), {
      activeTableName: undefined,
    })
    setNodes(nodes)
    setEdges(edges)
  }, [setActiveTableName, getNodes, getEdges, setNodes, setEdges])

  return {
    selectTable,
    revealTable,
    deselectTable,
  }
}
