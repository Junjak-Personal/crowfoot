// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import type { Node } from '@xyflow/react'
import { describe, expect, it } from 'vitest'
import { NON_RELATED_TABLE_GROUP_NODE_ID } from '../../../constants'
import { groupToNode } from '../../../utils'
import { tableIdsToHide } from './tableIdsToHide'

const aTableNode = (name: string): Node => ({
  id: name,
  type: 'table',
  position: { x: 0, y: 0 },
  data: {},
})

const aMemoNode = (id: string): Node => ({
  id,
  type: 'memo',
  position: { x: 0, y: 0 },
  data: { text: '' },
})

const aNonRelatedTableGroupNode = (): Node => ({
  id: NON_RELATED_TABLE_GROUP_NODE_ID,
  type: 'nonRelatedTableGroup',
  position: { x: 0, y: 0 },
  data: {},
})

/**
 * The canvas holds three fork node kinds beside tables. `?hidden=` carries
 * table names only, so every one of them has to be dropped here — the leak
 * this suite pins is a memo UUID or a `tableGroup:` id reaching a shared link.
 */
const mixedCanvas = (): Node[] => [
  groupToNode({ id: 'g1', name: 'Billing', tableNames: ['orders'] }),
  aNonRelatedTableGroupNode(),
  aTableNode('orders'),
  aTableNode('payments'),
  aTableNode('shipments'),
  aMemoNode('11111111-2222-3333-4444-555555555555'),
]

describe(tableIdsToHide, () => {
  it('returns only table ids, never memo, group or non-related-group node ids', () => {
    expect(tableIdsToHide(mixedCanvas(), ['orders'])).toEqual([
      'payments',
      'shipments',
    ])
  })

  it('returns every table when nothing is visible, and still no non-table id', () => {
    expect(tableIdsToHide(mixedCanvas(), [])).toEqual([
      'orders',
      'payments',
      'shipments',
    ])
  })

  it('returns nothing when every table is visible', () => {
    expect(
      tableIdsToHide(mixedCanvas(), ['orders', 'payments', 'shipments']),
    ).toEqual([])
  })

  it('ignores visible ids that name no table on the canvas', () => {
    // `visibleTableIds` comes from a schema extract, which can carry the
    // non-related group node id; it must not change which tables are hidden.
    expect(
      tableIdsToHide(mixedCanvas(), [
        'orders',
        NON_RELATED_TABLE_GROUP_NODE_ID,
        'dropped_table',
      ]),
    ).toEqual(['payments', 'shipments'])
  })
})
