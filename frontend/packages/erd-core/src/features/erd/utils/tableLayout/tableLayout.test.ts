import type { Node } from '@xyflow/react'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  applyTableLayout,
  clearStoredTableLayout,
  deserializeTableLayout,
  dumpTableLayout,
  getEffectiveTableLayout,
  loadStoredTableLayout,
  parseTableLayout,
  rememberTablePositions,
  serializeTableLayout,
  setBaseTableLayout,
  setResolvedTableLayout,
} from './tableLayout'

const node = (id: string, x: number, y: number): Node => ({
  id,
  type: 'table',
  position: { x, y },
  data: {},
})

describe(parseTableLayout, () => {
  it('keeps well-formed positions', () => {
    expect(parseTableLayout({ users: { x: 10, y: 20 } })).toEqual({
      users: { x: 10, y: 20 },
    })
  })

  it('drops entries that are not positions', () => {
    const layout = parseTableLayout({
      users: { x: 10, y: 20 },
      posts: { x: '10', y: 20 },
      comments: null,
      orders: { x: 1 },
    })

    expect(layout).toEqual({ users: { x: 10, y: 20 } })
  })

  it('returns an empty layout for non-objects', () => {
    expect(parseTableLayout(null)).toEqual({})
    expect(parseTableLayout('nope')).toEqual({})
  })
})

describe('layout precedence', () => {
  beforeEach(() => {
    clearStoredTableLayout()
    setBaseTableLayout({})
    setResolvedTableLayout([])
  })

  it('falls back to layout.json when nothing is stored', () => {
    setBaseTableLayout({ users: { x: 1, y: 2 } })

    expect(getEffectiveTableLayout()).toEqual({ users: { x: 1, y: 2 } })
  })

  it('lets a dragged table override layout.json', () => {
    setBaseTableLayout({ users: { x: 1, y: 2 }, posts: { x: 3, y: 4 } })
    rememberTablePositions([node('users', 99, 99)])

    expect(getEffectiveTableLayout()).toEqual({
      users: { x: 99, y: 99 },
      posts: { x: 3, y: 4 },
    })
  })

  it('keeps previously dragged tables when another one moves', () => {
    rememberTablePositions([node('users', 10, 10)])
    rememberTablePositions([node('posts', 20, 20)])

    expect(loadStoredTableLayout()).toEqual({
      users: { x: 10, y: 10 },
      posts: { x: 20, y: 20 },
    })
  })

  it('restores the canonical layout once local edits are cleared', () => {
    setBaseTableLayout({ users: { x: 1, y: 2 } })
    rememberTablePositions([node('users', 99, 99)])
    clearStoredTableLayout()

    expect(getEffectiveTableLayout()).toEqual({ users: { x: 1, y: 2 } })
  })
})

describe('url encoding', () => {
  it('round-trips through the compact form', () => {
    const layout = { users: { x: 10, y: 20 }, posts: { x: -30, y: 40 } }

    expect(deserializeTableLayout(serializeTableLayout(layout))).toEqual(layout)
  })

  it('rounds coordinates so shared links stay short', () => {
    expect(serializeTableLayout({ users: { x: 10.4829, y: -20.51 } })).toEqual([
      'users:10:-21',
    ])
  })

  it('survives table names containing the separator', () => {
    const layout = { 'weird:name': { x: 1, y: 2 } }

    expect(deserializeTableLayout(serializeTableLayout(layout))).toEqual(layout)
  })

  it('skips malformed entries instead of throwing', () => {
    expect(
      deserializeTableLayout(['users:1:2', 'broken', 'posts:x:2', ':1:2']),
    ).toEqual({ users: { x: 1, y: 2 } })
  })

  it('lets a shared link win over local edits', () => {
    clearStoredTableLayout()
    setBaseTableLayout({ users: { x: 1, y: 1 } })
    rememberTablePositions([node('users', 2, 2)])

    const fromUrl = deserializeTableLayout(['users:3:3'])

    expect(getEffectiveTableLayout(fromUrl)).toEqual({ users: { x: 3, y: 3 } })
  })
})

describe(applyTableLayout, () => {
  it('moves pinned tables and leaves the rest where they were', () => {
    const nodes = [node('users', 0, 0), node('posts', 5, 5)]

    const result = applyTableLayout(nodes, { users: { x: 100, y: 200 } })

    expect(result[0]?.position).toEqual({ x: 100, y: 200 })
    // Unpinned tables keep whatever the auto-layout gave them.
    expect(result[1]?.position).toEqual({ x: 5, y: 5 })
  })
})

describe(dumpTableLayout, () => {
  beforeEach(() => {
    clearStoredTableLayout()
    setBaseTableLayout({})
    setResolvedTableLayout([])
  })

  it('captures auto-layout positions so layout.json can be seeded', () => {
    setResolvedTableLayout([node('users', 1, 2), node('posts', 3, 4)])

    expect(dumpTableLayout()).toEqual({
      users: { x: 1, y: 2 },
      posts: { x: 3, y: 4 },
    })
  })

  it('reflects tables dragged after the initial layout', () => {
    setResolvedTableLayout([node('users', 1, 2), node('posts', 3, 4)])
    rememberTablePositions([node('posts', 30, 40)])

    expect(dumpTableLayout()).toEqual({
      users: { x: 1, y: 2 },
      posts: { x: 30, y: 40 },
    })
  })
})
