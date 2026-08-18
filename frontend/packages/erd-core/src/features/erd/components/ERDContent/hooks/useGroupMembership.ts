// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import {
  type Node,
  type OnSelectionChangeFunc,
  useReactFlow,
} from '@xyflow/react'
import { useCallback } from 'react'
import { useGroupNodes } from '../../../hooks'
import { type Group, isTableGroupNode, releaseTables } from '../../../utils'
import { useErdContentContext } from '../ErdContentContext'

/**
 * `tableNames` moved into one group and out of every other: a table belongs to
 * at most one group, so there is no membership to add that is not also a
 * membership given up.
 */
const movedTo =
  (groupId: string, tableNames: string[]) =>
  (current: Node[]): Node[] =>
    releaseTables(current, tableNames, groupId).map((node) =>
      isTableGroupNode(node) && node.data.groupId === groupId
        ? {
            ...node,
            data: {
              ...node.data,
              tableNames: node.data.tableNames.concat(
                tableNames.filter(
                  (name) => !node.data.tableNames.includes(name),
                ),
              ),
            },
          }
        : node,
    )

/**
 * Moving tables in and out of groups that already exist.
 *
 * Only `ungroup` existed before, so moving one table between two groups meant
 * dissolving a group and building it again — which cost its name and its
 * colour as well.
 */
export const useGroupMembership = () => {
  const { getNodes, setNodes } = useReactFlow()
  const { commitGroups } = useGroupNodes()
  const {
    actions: { setSelectedGroupId },
  } = useErdContentContext()

  const selectedTableNames = useCallback(
    () =>
      getNodes()
        .filter((node) => node.selected && node.type === 'table')
        .map((node) => node.id),
    [getNodes],
  )

  const moveSelectionToGroup = useCallback(
    (groupId: string) => {
      const tableNames = selectedTableNames()
      if (tableNames.length > 0) commitGroups(movedTo(groupId, tableNames))
    },
    [selectedTableNames, commitGroups],
  )

  const removeSelectionFromGroups = useCallback(() => {
    const tableNames = selectedTableNames()
    if (tableNames.length > 0) {
      commitGroups((current) => releaseTables(current, tableNames, null))
    }
  }, [selectedTableNames, commitGroups])

  /** The group is not named: a table is in one, so there is only one to leave. */
  const removeTableFromItsGroup = useCallback(
    (tableName: string) =>
      commitGroups((current) => releaseTables(current, [tableName], null)),
    [commitGroups],
  )

  /** Steps down a level: from the group as an object to the tables in it. */
  const enterGroup = useCallback(
    (group: Group) => {
      const members = new Set(group.tableNames)

      setSelectedGroupId(null)
      setNodes((current) =>
        current.map((node) => ({ ...node, selected: members.has(node.id) })),
      )
    },
    [setSelectedGroupId, setNodes],
  )

  /**
   * The two selection kinds are exclusive, and React Flow owns one of them.
   * Selecting a group already clears the nodes; this is the other direction —
   * the moment anything is node-selected, a group cannot still be what is
   * selected. Only a non-empty selection clears it, so the `setNodes` that
   * selecting a group runs first does not immediately undo itself.
   */
  const dropGroupSelection: OnSelectionChangeFunc = useCallback(
    ({ nodes }) => {
      if (nodes.length > 0) setSelectedGroupId(null)
    },
    [setSelectedGroupId],
  )

  return {
    moveSelectionToGroup,
    removeSelectionFromGroups,
    removeTableFromItsGroup,
    enterGroup,
    dropGroupSelection,
  }
}
