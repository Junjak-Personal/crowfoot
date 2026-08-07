// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import type { Node } from '@xyflow/react'
import { describe, expect, it } from 'vitest'
import { NON_RELATED_TABLE_GROUP_NODE_ID } from '../../constants'
import { reconcileTableNodes } from './reconcileTableNodes'
import { settleOverlaps } from './settleOverlaps'

type TableData = { table: { name: string }; sourceColumnName?: string }

const tableNode = (
  id: string,
  data: TableData,
  overrides: Partial<Node> = {},
): Node => ({
  id,
  type: 'table',
  data: { ...data, targetColumnCardinalities: undefined },
  position: { x: 0, y: 0 },
  ...overrides,
})

const groupNode = (position = { x: 0, y: 0 }): Node => ({
  id: NON_RELATED_TABLE_GROUP_NODE_ID,
  type: 'nonRelatedTableGroup',
  data: {},
  position,
})

const place = () => ({ x: 999, y: 999 })

describe(reconcileTableNodes, () => {
  it('returns the same array when the schema did not change', () => {
    const shared = { table: { name: 'users' } }
    const current = [tableNode('users', shared)]
    const incoming = [tableNode('users', shared)]

    expect(reconcileTableNodes({ current, incoming, place })).toBe(current)
  })

  it('keeps position, selection and measurement while replacing data', () => {
    const current = [
      tableNode(
        'users',
        { table: { name: 'users' } },
        {
          position: { x: 100, y: 200 },
          selected: true,
          measured: { width: 10, height: 20 },
          data: {
            table: { name: 'users' },
            targetColumnCardinalities: undefined,
            color: 'gold',
          },
        },
      ),
    ]
    const edited = { name: 'users', comment: 'edited' }
    const incoming = [tableNode('users', { table: edited })]

    const [node] = reconcileTableNodes({ current, incoming, place })

    expect(node?.position).toEqual({ x: 100, y: 200 })
    expect(node?.selected).toBe(true)
    expect(node?.measured).toEqual({ width: 10, height: 20 })
    expect(node?.data['table']).toBe(edited)
    // Colour is put on the node by the layout pass, not by the schema.
    expect(node?.data['color']).toBe('gold')
  })

  it('hands measurement back so a table that grew reports it', () => {
    // The automatic layout writes width/height onto every node it places, and
    // React Flow honours them instead of measuring.
    const current = [
      tableNode(
        'users',
        { table: { name: 'users' } },
        { width: 220, height: 107, measured: { width: 220, height: 107 } },
      ),
    ]
    const incoming = [tableNode('users', { table: { name: 'users' } })]

    const [node] = reconcileTableNodes({ current, incoming, place })

    expect(node?.width).toBeUndefined()
    expect(node?.height).toBeUndefined()
  })

  it('clears a value the schema no longer has', () => {
    const current = [
      tableNode(
        'orders',
        { table: { name: 'orders' } },
        {
          data: {
            table: { name: 'orders' },
            targetColumnCardinalities: { users_id: 'ONE_TO_MANY' },
          },
        },
      ),
    ]
    const incoming = [tableNode('orders', { table: { name: 'orders' } })]

    const [node] = reconcileTableNodes({ current, incoming, place })

    expect(node?.data['targetColumnCardinalities']).toBeUndefined()
  })

  it('places a table that was not there before', () => {
    const current = [tableNode('users', { table: { name: 'users' } })]
    const incoming = [
      ...current,
      tableNode('orders', { table: { name: 'orders' } }),
    ]

    const result = reconcileTableNodes({ current, incoming, place })

    expect(result.map((node) => node.id)).toEqual(['users', 'orders'])
    expect(result[1]?.position).toEqual({ x: 999, y: 999 })
  })

  it('drops a table the schema no longer has', () => {
    const current = [
      tableNode('users', { table: { name: 'users' } }),
      tableNode('orders', { table: { name: 'orders' } }),
    ]
    const incoming = current.slice(0, 1)

    expect(
      reconcileTableNodes({ current, incoming, place }).map((n) => n.id),
    ).toEqual(['users'])
  })

  it('leaves memos and group boxes alone', () => {
    const memo: Node = {
      id: 'memo-1',
      type: 'memo',
      data: { text: 'hi' },
      position: { x: 5, y: 5 },
    }
    const current = [memo, tableNode('users', { table: { name: 'users' } })]
    const incoming = [tableNode('users', { table: { name: 'users2' } })]

    const result = reconcileTableNodes({ current, incoming, place })

    expect(result[0]).toBe(memo)
  })

  describe('non-related group membership', () => {
    it('reframes a table leaving the group so it does not jump', () => {
      const current = [
        groupNode({ x: 300, y: 400 }),
        tableNode(
          'users',
          { table: { name: 'users' } },
          {
            position: { x: 10, y: 20 },
            parentId: NON_RELATED_TABLE_GROUP_NODE_ID,
          },
        ),
      ]
      // Gaining a foreign key drops the table out of the group.
      const incoming = [tableNode('users', { table: { name: 'users' } })]

      const result = reconcileTableNodes({ current, incoming, place })
      const table = result.find((node) => node.id === 'users')

      expect(table?.parentId).toBeUndefined()
      expect(table?.position).toEqual({ x: 310, y: 420 })
    })

    it('reframes a table joining the group', () => {
      const current = [
        tableNode(
          'users',
          { table: { name: 'users' } },
          { position: { x: 310, y: 420 } },
        ),
      ]
      const incoming = [
        groupNode({ x: 300, y: 400 }),
        tableNode(
          'users',
          { table: { name: 'users' } },
          { parentId: NON_RELATED_TABLE_GROUP_NODE_ID },
        ),
      ]

      const result = reconcileTableNodes({ current, incoming, place })

      expect(result[0]?.id).toBe(NON_RELATED_TABLE_GROUP_NODE_ID)
      expect(result.find((node) => node.id === 'users')?.position).toEqual({
        x: 10,
        y: 20,
      })
    })

    it('drops the group box once every table has a relationship', () => {
      const current = [
        groupNode(),
        tableNode(
          'users',
          { table: { name: 'users' } },
          { parentId: NON_RELATED_TABLE_GROUP_NODE_ID },
        ),
      ]
      const incoming = [tableNode('users', { table: { name: 'users' } })]

      expect(
        reconcileTableNodes({ current, incoming, place }).map((n) => n.id),
      ).toEqual(['users'])
    })
  })
})

const box = (
  id: string,
  x: number,
  y: number,
  width = 100,
  height = 100,
  overrides: Partial<Node> = {},
): Node => ({
  id,
  type: 'table',
  data: {},
  position: { x, y },
  measured: { width, height },
  ...overrides,
})

describe(settleOverlaps, () => {
  it('does nothing when nothing grew', () => {
    const nodes = [box('a', 0, 0), box('b', 0, 50)]
    expect(settleOverlaps({ nodes, grownIds: new Set() })).toBe(nodes)
  })

  it('pushes an overlapped table clear, below the one that grew', () => {
    const nodes = [box('a', 0, 0, 100, 300), box('b', 0, 100)]

    const [, b] = settleOverlaps({ nodes, grownIds: new Set(['a']) })

    expect(b?.position).toEqual({ x: 0, y: 340 })
  })

  it('leaves a table that is already clear where it is', () => {
    const nodes = [box('a', 0, 0), box('b', 0, 500)]
    expect(settleOverlaps({ nodes, grownIds: new Set(['a']) })).toBe(nodes)
  })

  it('ignores tables in another column', () => {
    const nodes = [box('a', 0, 0, 100, 300), box('b', 200, 100)]
    expect(settleOverlaps({ nodes, grownIds: new Set(['a']) })).toBe(nodes)
  })

  it('never pulls anything up when a table shrinks', () => {
    const nodes = [box('a', 0, 0, 100, 50), box('b', 0, 400)]
    expect(settleOverlaps({ nodes, grownIds: new Set(['a']) })).toBe(nodes)
  })

  it('never moves a table that starts above the one that grew', () => {
    const nodes = [box('a', 0, 200, 100, 300), box('b', 0, 150)]
    expect(settleOverlaps({ nodes, grownIds: new Set(['a']) })).toBe(nodes)
  })

  it('cascades to whatever the pushed table now runs into', () => {
    const nodes = [box('a', 0, 0, 100, 300), box('b', 0, 100), box('c', 0, 220)]

    const result = settleOverlaps({ nodes, grownIds: new Set(['a']) })

    expect(result[1]?.position.y).toBe(340)
    expect(result[2]?.position.y).toBe(480)
  })

  it('never moves the table that grew', () => {
    const nodes = [box('a', 0, 0, 100, 300), box('b', 0, 100)]

    expect(
      settleOverlaps({ nodes, grownIds: new Set(['a']) })[0]?.position,
    ).toEqual({ x: 0, y: 0 })
  })

  it('compares in absolute space but writes back parent-relative', () => {
    const nodes: Node[] = [
      groupNode({ x: 1000, y: 1000 }),
      box('a', 0, 0, 100, 300, { parentId: NON_RELATED_TABLE_GROUP_NODE_ID }),
      box('b', 1000, 1100),
    ]

    const result = settleOverlaps({ nodes, grownIds: new Set(['a']) })

    // `a` spans 1000..1300 absolute; `b` starts at 1100 and is pushed to 1340.
    expect(result[2]?.position).toEqual({ x: 1000, y: 1340 })
  })

  it('skips tables that have not been measured yet', () => {
    const nodes: Node[] = [
      box('a', 0, 0, 100, 300),
      { id: 'b', type: 'table', data: {}, position: { x: 0, y: 100 } },
    ]

    expect(settleOverlaps({ nodes, grownIds: new Set(['a']) })).toBe(nodes)
  })
})
