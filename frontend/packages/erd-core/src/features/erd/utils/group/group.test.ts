// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import { aTable } from '@crowfoot/schema'
import { beforeEach, describe, expect, it } from 'vitest'
import { zIndex } from '../../constants'
import type { TableNodeData, TableNodeType } from '../../types'
import {
  deserializeGroups,
  type Group,
  getEffectiveGroups,
  parseGroups,
  partitionTablesByGroup,
  serializeGroups,
  setBaseGroups,
} from './group'
import {
  GROUP_BOX_PADDING,
  groupsFromNodes,
  groupToNode,
  isTableGroupNode,
  nodeToGroup,
  padGroupRect,
  resolveGroupMemberIds,
  tableGroupNodesFrom,
} from './groupNode'

const group = (
  id: string,
  tableNames: string[],
  override?: Partial<Group>,
): Group => ({
  id,
  name: id,
  tableNames,
  ...override,
})

const aTableData = (
  name: string,
  override?: Partial<TableNodeData>,
): TableNodeData => ({
  table: aTable({ name }),
  isActiveHighlighted: false,
  isHighlighted: false,
  isTooltipVisible: false,
  sourceColumnName: undefined,
  ...override,
})

const aTableNode = (
  name: string,
  override?: Partial<TableNodeType>,
): TableNodeType => ({
  id: name,
  type: 'table',
  position: { x: 0, y: 0 },
  ...override,
  data: aTableData(name, override?.data),
})

describe(parseGroups, () => {
  it('keeps well-formed groups', () => {
    expect(parseGroups([group('payment', ['orders', 'payments'])])).toEqual([
      group('payment', ['orders', 'payments']),
    ])
  })

  it('keeps an empty name', () => {
    expect(
      parseGroups([{ id: 'a', name: '', tableNames: ['orders'] }]),
    ).toEqual([{ id: 'a', name: '', tableNames: ['orders'] }])
  })

  it('drops an entry with a missing, non-string, or empty id', () => {
    expect(
      parseGroups([
        { name: 'x', tableNames: ['a'] },
        { id: 1, name: 'x', tableNames: ['a'] },
        { id: '', name: 'x', tableNames: ['a'] },
      ]),
    ).toEqual([])
  })

  it('drops an entry with a non-string name', () => {
    expect(parseGroups([{ id: 'a', name: 1, tableNames: ['x'] }])).toEqual([])
  })

  it('drops an entry with missing, non-array, or empty tableNames', () => {
    expect(
      parseGroups([
        { id: 'a', name: 'x' },
        { id: 'b', name: 'x', tableNames: 'nope' },
        { id: 'c', name: 'x', tableNames: [] },
      ]),
    ).toEqual([])
  })

  it('drops non-string entries within tableNames but keeps the entry if a string survives', () => {
    expect(
      parseGroups([
        { id: 'a', name: 'x', tableNames: ['orders', 42, null, 'payments'] },
      ]),
    ).toEqual([{ id: 'a', name: 'x', tableNames: ['orders', 'payments'] }])
  })

  it('drops the entry when tableNames contains no strings at all', () => {
    expect(
      parseGroups([{ id: 'a', name: 'x', tableNames: [42, null, false] }]),
    ).toEqual([])
  })

  it('dedupes tableNames within one entry', () => {
    expect(
      parseGroups([{ id: 'a', name: 'x', tableNames: ['t', 't'] }])[0]
        ?.tableNames,
    ).toEqual(['t'])
  })

  it('coerces a color outside the palette to undefined, keeping the entry', () => {
    expect(
      parseGroups([
        { id: 'a', name: 'x', tableNames: ['t'], color: 'chartreuse' },
      ]),
    ).toEqual([{ id: 'a', name: 'x', tableNames: ['t'], color: undefined }])
  })

  it('keeps a valid color', () => {
    expect(
      parseGroups([{ id: 'a', name: 'x', tableNames: ['t'], color: 'gold' }]),
    ).toEqual([{ id: 'a', name: 'x', tableNames: ['t'], color: 'gold' }])
  })

  it('keeps the first of two entries sharing an id', () => {
    expect(
      parseGroups([
        { id: 'a', name: 'first', tableNames: ['t'] },
        { id: 'a', name: 'second', tableNames: ['u'] },
      ]),
    ).toEqual([{ id: 'a', name: 'first', tableNames: ['t'] }])
  })

  it('returns an empty list for non-arrays instead of throwing', () => {
    expect(parseGroups(null)).toEqual([])
    expect(parseGroups({ id: 'a' })).toEqual([])
    expect(parseGroups('nope')).toEqual([])
    expect(parseGroups(undefined)).toEqual([])
  })

  it('drops malformed entries instead of throwing', () => {
    expect(
      parseGroups([null, 'nope', 42, { id: 'a' }, { tableNames: ['t'] }]),
    ).toEqual([])
  })

  it('a corrupt entry does not prevent the remaining valid entries from parsing', () => {
    expect(
      parseGroups([
        { id: 'a', name: 'ok', tableNames: ['t'] },
        null,
        { id: 'b' },
        { id: 'c', name: 'also ok', tableNames: ['u'] },
      ]),
    ).toEqual([
      { id: 'a', name: 'ok', tableNames: ['t'] },
      { id: 'c', name: 'also ok', tableNames: ['u'] },
    ])
  })

  it('survives a __proto__ id and tableNames without adding any own property to Object.prototype', () => {
    const before = Object.getOwnPropertyNames(Object.prototype)

    const parsed = parseGroups([
      { id: '__proto__', name: 'x', tableNames: ['__proto__'] },
    ])

    expect(parsed).toEqual([
      { id: '__proto__', name: 'x', tableNames: ['__proto__'] },
    ])
    expect(Object.getOwnPropertyNames(Object.prototype)).toEqual(before)
    // The tell: if a field had leaked onto the prototype, an unrelated plain
    // object would suddenly "have" it as an inherited property.
    expect('tableNames' in {}).toBe(false)
  })

  it('survives a constructor id and tableNames value without touching Object.prototype', () => {
    const beforeCtor = Object.prototype.constructor

    const parsed = parseGroups([
      { id: 'constructor', name: 'x', tableNames: ['constructor'] },
    ])

    expect(parsed).toEqual([
      { id: 'constructor', name: 'x', tableNames: ['constructor'] },
    ])
    // The tell: if the literal key had reached the prototype chain instead
    // of staying an own property, Object.prototype's own constructor would
    // have been clobbered.
    expect(Object.prototype.constructor).toBe(beforeCtor)
  })
})

describe('groups on top of groups.json', () => {
  beforeEach(() => {
    setBaseGroups([])
  })

  /** The link said nothing, so the diagram is exactly what was deployed. */
  it('is groups.json when the link carries nothing', () => {
    setBaseGroups([group('shipped', ['orders'])])

    expect(getEffectiveGroups()).toEqual([group('shipped', ['orders'])])
  })

  it('carries only the group that changed', () => {
    const base = [group('shipped', ['orders']), group('other', ['users'])]
    const next = [
      group('shipped', ['orders'], { name: 'edited' }),
      group('other', ['users']),
    ]

    expect(JSON.parse(serializeGroups(base, next))).toEqual({
      changed: { shipped: next[0] },
      removed: [],
    })
  })

  /**
   * The whole point of the diff: a redeployed groups.json still reaches
   * someone holding a link, for every group they did not touch.
   */
  it('lets a redeployed group through for anything the link did not touch', () => {
    const base = [group('shipped', ['orders']), group('other', ['users'])]
    const link = deserializeGroups(
      serializeGroups(base, [
        group('shipped', ['orders'], { name: 'edited' }),
        group('other', ['users']),
      ]),
    )

    const redeployed = [
      group('shipped', ['orders']),
      group('other', ['users'], { name: 'renamed upstream' }),
    ]

    expect(getEffectiveGroups(link, redeployed)).toEqual([
      group('shipped', ['orders'], { name: 'edited' }),
      group('other', ['users'], { name: 'renamed upstream' }),
    ])
  })

  it('expresses a deletion, which a plain merge could not', () => {
    const kept = group('other', ['users'])
    const base = [group('shipped', ['orders']), kept]
    const link = deserializeGroups(serializeGroups(base, [kept]))

    expect(getEffectiveGroups(link, base)).toEqual([kept])
  })

  it('keeps a group the viewer added', () => {
    const base = [group('shipped', ['orders'])]
    const link = deserializeGroups(
      serializeGroups(base, [...base, group('added', ['users'])]),
    )

    expect(getEffectiveGroups(link, base)).toEqual([
      group('shipped', ['orders']),
      group('added', ['users']),
    ])
  })

  it('says nothing at all once every edit is undone by hand', () => {
    const base = [group('shipped', ['orders'])]

    expect(serializeGroups(base, [...base])).toBe('')
  })
})

describe('url encoding', () => {
  const base = [group('a', ['orders'])]

  it('round-trips through JSON, including an empty name, a colour, and separator characters', () => {
    const next: Group[] = [
      group('a', ['orders', 'payments'], { name: '', color: 'gold' }),
      group('b:x', ['weird,name'], { name: 'has:colon,and,comma' }),
    ]

    expect(
      getEffectiveGroups(deserializeGroups(serializeGroups(base, next)), base),
    ).toEqual(next)
  })

  it('reads an empty value as "the link said nothing"', () => {
    expect(deserializeGroups('')).toBeNull()
  })

  it('reads malformed JSON as no edits rather than throwing', () => {
    expect(getEffectiveGroups(deserializeGroups('not json'), base)).toEqual(
      base,
    )
    expect(getEffectiveGroups(deserializeGroups('{"broken":'), base)).toEqual(
      base,
    )
  })
})

describe(partitionTablesByGroup, () => {
  const orders = aTableNode('orders')
  const payments = aTableNode('payments')
  const shipments = aTableNode('shipments')
  const users = aTableNode('users')

  it('every table appears exactly once in flat, alphabetically, regardless of grouping', () => {
    const partition = partitionTablesByGroup(
      [shipments, orders, users, payments],
      [group('payment', ['orders', 'payments'])],
    )

    expect(partition.flat.map((n) => n.id)).toEqual([
      'orders',
      'payments',
      'shipments',
      'users',
    ])
  })

  it('a table named by two surviving groups appears in both sections and not in Ungrouped', () => {
    const partition = partitionTablesByGroup(
      [orders, payments, shipments],
      [
        group('payment', ['orders', 'payments']),
        group('settlement', ['payments']),
      ],
    )

    const paymentsSections = partition.sections.filter((section) =>
      section.nodes.some((n) => n.id === 'payments'),
    )
    expect(paymentsSections).toHaveLength(2)

    const ungrouped = partition.sections.find((s) => s.group === null)
    expect(ungrouped?.nodes.map((n) => n.id)).toEqual(['shipments'])
  })

  it('a table named by zero groups lands in Ungrouped exactly once', () => {
    const partition = partitionTablesByGroup(
      [orders, users],
      [group('payment', ['orders'])],
    )

    const ungrouped = partition.sections.find((s) => s.group === null)
    expect(ungrouped?.nodes.map((n) => n.id)).toEqual(['users'])
  })

  it('no table ever vanishes across zero-, one-, and two-group membership', () => {
    const partition = partitionTablesByGroup(
      [orders, payments, shipments, users],
      [
        group('payment', ['orders', 'payments']),
        group('settlement', ['payments']),
      ],
    )

    const idsAcrossSections = new Set(
      partition.sections.flatMap((s) => s.nodes.map((n) => n.id)),
    )
    const idsInFlat = new Set(partition.flat.map((n) => n.id))

    expect(idsAcrossSections).toEqual(idsInFlat)
  })

  it('flattenedUnique set-equals flat, has no duplicate ids, and follows first-appearance order', () => {
    const partition = partitionTablesByGroup(
      [orders, payments, shipments],
      [
        group('payment', ['orders', 'payments']),
        group('settlement', ['payments']),
      ],
    )

    expect(new Set(partition.flattenedUnique.map((n) => n.id))).toEqual(
      new Set(partition.flat.map((n) => n.id)),
    )
    const ids = partition.flattenedUnique.map((n) => n.id)
    expect(new Set(ids).size).toBe(ids.length)
    // First-appearance order of the concatenated sections: `payment`
    // (orders, payments) then `settlement` (payments again, skipped) then
    // Ungrouped (shipments).
    expect(ids).toEqual(['orders', 'payments', 'shipments'])
  })

  it('flattenedUnique.length equals flat.length even when the sections total more (the shift-range discriminator)', () => {
    const partition = partitionTablesByGroup(
      [orders, payments],
      [
        group('payment', ['orders', 'payments']),
        group('settlement', ['payments']),
      ],
    )

    const totalAcrossSections = partition.sections.reduce(
      (sum, s) => sum + s.nodes.length,
      0,
    )
    expect(totalAcrossSections).toBeGreaterThan(
      partition.flattenedUnique.length,
    )
    expect(partition.flattenedUnique).toHaveLength(partition.flat.length)
  })

  it('a group whose members were all dropped contributes no section; unnamed real tables still land in Ungrouped', () => {
    const partition = partitionTablesByGroup(
      [orders, users],
      [group('ghost', ['deleted-table']), group('payment', ['orders'])],
    )

    expect(partition.sections.map((s) => s.group?.id ?? 'ungrouped')).toEqual([
      'payment',
      'ungrouped',
    ])
    const ungrouped = partition.sections.find((s) => s.group === null)
    expect(ungrouped?.nodes.map((n) => n.id)).toEqual(['users'])
  })

  it('sections follow groups.json order, with Ungrouped last', () => {
    const partition = partitionTablesByGroup(
      [orders, payments, shipments, users],
      [
        group('shipping', ['shipments']),
        group('payment', ['orders', 'payments']),
      ],
    )

    expect(partition.sections.map((s) => s.group?.id ?? 'ungrouped')).toEqual([
      'shipping',
      'payment',
      'ungrouped',
    ])
  })

  it('sorts tables alphabetically within a section, using the same comparator as today', () => {
    const partition = partitionTablesByGroup(
      [payments, orders],
      [group('payment', ['orders', 'payments'])],
    )

    expect(partition.sections[0]?.nodes.map((n) => n.id)).toEqual([
      'orders',
      'payments',
    ])
  })

  it('zero groups yields sectioned: false, no sections, and no stray Ungrouped', () => {
    const partition = partitionTablesByGroup([orders, users], [])

    expect(partition.sectioned).toBe(false)
    expect(partition.sections).toEqual([])
    // Documented on TablePartition itself: `flattenedUnique` is `[]` when
    // `!sectioned`, since the single-view render path is meant to consume
    // `flat`, never this field.
    expect(partition.flattenedUnique).toEqual([])
    expect(partition.flat.map((n) => n.id)).toEqual(['orders', 'users'])
  })

  it('groups present but every member dropped also yields sectioned: false', () => {
    const partition = partitionTablesByGroup(
      [orders, users],
      [group('ghost', ['deleted-table'])],
    )

    expect(partition.sectioned).toBe(false)
    expect(partition.sections).toEqual([])
    expect(partition.flattenedUnique).toEqual([])
  })

  it('does not mutate the order of the caller-supplied array', () => {
    const input = [users, orders]
    partitionTablesByGroup(input, [group('payment', ['orders'])])

    expect(input).toEqual([users, orders])
  })

  it('a __proto__ group id does not corrupt the output', () => {
    const partition = partitionTablesByGroup(
      [orders],
      [group('__proto__', ['orders'])],
    )

    expect(partition.sectioned).toBe(true)
    expect(partition.sections[0]?.group?.id).toBe('__proto__')
    expect(partition.sections[0]?.nodes.map((n) => n.id)).toEqual(['orders'])
    // Same tell as the parseGroups case above: an inherited property on an
    // unrelated plain object would mean Object.prototype was polluted.
    expect('orders' in {}).toBe(false)
  })

  it('keeps the first of two groups sharing an id, exactly like parseGroups', () => {
    const partition = partitionTablesByGroup(
      [orders, payments, users],
      [
        group('a', ['orders'], { name: 'first' }),
        group('a', ['payments'], { name: 'second' }),
      ],
    )

    expect(partition.sections).toHaveLength(2) // the group section + Ungrouped
    expect(partition.sections[0]?.group).toEqual(
      group('a', ['orders'], { name: 'first' }),
    )
    // The surviving section's members are the FIRST group's, not the
    // second's — a future last-wins regression would fail here.
    expect(partition.sections[0]?.nodes.map((n) => n.id)).toEqual(['orders'])
    expect(
      partition.sections.find((s) => s.group === null)?.nodes.map((n) => n.id),
    ).toEqual(['payments', 'users'])
  })
})

describe(isTableGroupNode, () => {
  it('recognizes a tableGroup node and rejects everything else', () => {
    const node = groupToNode(group('payment', ['orders']))

    expect(isTableGroupNode(node)).toBe(true)
    expect(isTableGroupNode(aTableNode('orders'))).toBe(false)
  })
})

describe('groupToNode / nodeToGroup', () => {
  it('round-trips a group through its node shape', () => {
    const original = group('payment', ['orders', 'payments'], {
      name: 'Payment Group',
      color: 'gold',
    })

    expect(nodeToGroup(groupToNode(original))).toEqual(original)
  })

  it('prefixes the node id so it can never collide with a table node id, and the real id lives in data.groupId', () => {
    const node = groupToNode(group('orders', ['orders']))

    expect(node.id).toBe('tableGroup:orders')
    expect(node.id).not.toBe('orders')
    expect(node.data.groupId).toBe('orders')
  })

  it('is measured at zero, not left unmeasured, so nodesInitialized can still become true', () => {
    const node = groupToNode(group('payment', ['orders']))

    expect(node.measured).toEqual({ width: 0, height: 0 })
  })

  it('is never draggable or selectable, and sits at the tableGroupBox zIndex', () => {
    const node = groupToNode(group('payment', ['orders']))

    expect(node.draggable).toBe(false)
    expect(node.selectable).toBe(false)
    expect(node.zIndex).toBe(zIndex.tableGroupBox)
  })

  it('tableGroupBox zIndex is exactly -1, below every edge and every table (F2)', () => {
    // node.zIndex === zIndex.tableGroupBox above is tautological on its own —
    // it would still pass if the constant regressed back to `nodeDefault - 1`
    // (F2's original bug: 1, colliding with edgeHighlighted). Pin the literal
    // value and its ordering against the rest of the zIndex scale directly.
    expect(zIndex.tableGroupBox).toBe(-1)
    expect(zIndex.tableGroupBox).toBeLessThan(zIndex.edgeDefault)
    expect(zIndex.tableGroupBox).toBeLessThan(zIndex.edgeHighlighted)
    expect(zIndex.tableGroupBox).toBeLessThan(zIndex.nodeDefault)
  })
})

describe('groupsFromNodes / tableGroupNodesFrom', () => {
  it('round-trips a list of groups through node form, ignoring non-group nodes', () => {
    const groups = [group('a', ['orders']), group('b', ['users'])]
    const nodes = [...tableGroupNodesFrom(groups), aTableNode('orders')]

    expect(groupsFromNodes(nodes)).toEqual(groups)
  })
})

describe(resolveGroupMemberIds, () => {
  const measured = { width: 100, height: 60 }

  it('drops members absent from the current node list', () => {
    const nodes = [aTableNode('orders', { measured })]

    expect(resolveGroupMemberIds(['orders', 'ghost'], nodes)).toEqual([
      'orders',
    ])
  })

  it('excludes hidden members', () => {
    const nodes = [
      aTableNode('orders', { measured }),
      aTableNode('payments', { measured, hidden: true }),
    ]

    expect(resolveGroupMemberIds(['orders', 'payments'], nodes)).toEqual([
      'orders',
    ])
  })

  it('returns null, not [], when every member is absent or hidden', () => {
    const nodes = [aTableNode('payments', { measured, hidden: true })]

    expect(resolveGroupMemberIds(['ghost'], nodes)).toBeNull()
    expect(resolveGroupMemberIds(['payments'], nodes)).toBeNull()
    expect(resolveGroupMemberIds([], nodes)).toBeNull()
  })

  it('returns null when any visible member is unmeasured, rather than drawing a partial box', () => {
    const nodes = [
      aTableNode('orders', { measured }),
      aTableNode('payments'), // no `measured` yet
    ]

    expect(resolveGroupMemberIds(['orders', 'payments'], nodes)).toBeNull()
  })
})

describe(padGroupRect, () => {
  it('the padding constant is exactly 24px, per the plan — not just internally consistent', () => {
    // Deriving the expectation from GROUP_BOX_PADDING itself (as the rect
    // test below does) would pass even if the constant silently drifted
    // from the spec'd 24. Lock the literal value down separately.
    expect(GROUP_BOX_PADDING).toBe(24)
  })

  it('pads a rect by GROUP_BOX_PADDING on all four sides', () => {
    expect(padGroupRect({ x: 100, y: 200, width: 50, height: 30 })).toEqual({
      x: 100 - GROUP_BOX_PADDING,
      y: 200 - GROUP_BOX_PADDING,
      width: 50 + GROUP_BOX_PADDING * 2,
      height: 30 + GROUP_BOX_PADDING * 2,
    })
  })
})
