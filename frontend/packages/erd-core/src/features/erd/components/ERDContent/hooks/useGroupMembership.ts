// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import {
  type Node,
  type OnSelectionChangeFunc,
  useReactFlow,
} from '@xyflow/react'
import { useCallback } from 'react'
import { useGroupNodes } from '../../../hooks'
import { type Group, isTableGroupNode } from '../../../utils'
import { useErdContentContext } from '../ErdContentContext'

/**
 * One group with `tableNames` taken out of it, and dropped entirely if that
 * empties it: an empty `tableNames` is not representable in `groups.json`
 * (`parseGroups` discards it), so a node kept here would make the canvas and a
 * reloaded `?groups=` disagree. Memberships of the same tables in *other*
 * groups are untouched — a table may belong to several.
 */
const withoutMembers =
  (groupId: string, tableNames: Set<string>) =>
  (current: Node[]): Node[] =>
    current
      .map((node) =>
        isTableGroupNode(node) && node.data.groupId === groupId
          ? {
              ...node,
              data: {
                ...node.data,
                tableNames: node.data.tableNames.filter(
                  (name) => !tableNames.has(name),
                ),
              },
            }
          : node,
      )
      .filter(
        (node) => !isTableGroupNode(node) || node.data.tableNames.length > 0,
      )

/** One group with `tableNames` appended, skipping the ones already in it. */
const withMembers =
  (groupId: string, tableNames: string[]) =>
  (current: Node[]): Node[] =>
    current.map((node) =>
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

  const addSelectionToGroup = useCallback(
    (groupId: string) => {
      const tableNames = selectedTableNames()
      if (tableNames.length > 0) commitGroups(withMembers(groupId, tableNames))
    },
    [selectedTableNames, commitGroups],
  )

  const removeSelectionFromGroup = useCallback(
    (groupId: string) => {
      const tableNames = selectedTableNames()
      if (tableNames.length > 0) {
        commitGroups(withoutMembers(groupId, new Set(tableNames)))
      }
    },
    [selectedTableNames, commitGroups],
  )

  const removeTableFromGroup = useCallback(
    (groupId: string, tableName: string) =>
      commitGroups(withoutMembers(groupId, new Set([tableName]))),
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
    addSelectionToGroup,
    removeSelectionFromGroup,
    removeTableFromGroup,
    enterGroup,
    dropGroupSelection,
  }
}
