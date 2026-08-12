// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import type { Node } from '@xyflow/react'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  applyTableLayout,
  deserializeTableLayout,
  dumpTableLayout,
  getEffectiveTableLayout,
  getTableColor,
  parseTableLayout,
  pruneToBaseLayout,
  rememberTablePositions,
  renameTableInLayout,
  serializeTableLayout,
  setBaseTableLayout,
  setResolvedTableLayout,
  setTableColor,
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
    setBaseTableLayout({})
    setResolvedTableLayout([])
  })

  it('is layout.json when the link carries nothing', () => {
    setBaseTableLayout({ users: { x: 1, y: 2 } })

    expect(getEffectiveTableLayout()).toEqual({ users: { x: 1, y: 2 } })
  })

  it('lets a link override layout.json for the tables it names', () => {
    setBaseTableLayout({ users: { x: 1, y: 2 }, posts: { x: 3, y: 4 } })

    expect(
      getEffectiveTableLayout(deserializeTableLayout(['users:99:99'])),
    ).toEqual({
      users: { x: 99, y: 99 },
      posts: { x: 3, y: 4 },
    })
  })

  it('hands back only the tables the gesture moved', () => {
    expect(rememberTablePositions([node('users', 10, 10)])).toEqual({
      users: { x: 10, y: 10 },
    })
  })
})

describe(pruneToBaseLayout, () => {
  beforeEach(() => {
    setBaseTableLayout({})
    setResolvedTableLayout([])
  })

  /** Dragging a table back where it shipped should stop pinning it. */
  it('drops an entry that says what layout.json already says', () => {
    setBaseTableLayout({ users: { x: 1, y: 2 } })

    expect(pruneToBaseLayout({ users: { x: 1, y: 2 } })).toEqual({})
  })

  it('keeps an entry that moved the table', () => {
    setBaseTableLayout({ users: { x: 1, y: 2 } })

    expect(pruneToBaseLayout({ users: { x: 9, y: 9 } })).toEqual({
      users: { x: 9, y: 9 },
    })
  })

  it('keeps a table layout.json never pinned', () => {
    expect(pruneToBaseLayout({ users: { x: 0, y: 0 } })).toEqual({
      users: { x: 0, y: 0 },
    })
  })

  /** Colour rides in the same entry, and is not a position. */
  it('keeps an entry carrying a colour even where the position matches', () => {
    setBaseTableLayout({ users: { x: 1, y: 2 } })

    expect(pruneToBaseLayout({ users: { x: 1, y: 2, color: 'gold' } })).toEqual(
      {
        users: { x: 1, y: 2, color: 'gold' },
      },
    )
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

  it('lets a shared link win over layout.json', () => {
    setBaseTableLayout({ users: { x: 1, y: 1 } })

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

describe('table color', () => {
  beforeEach(() => {
    setBaseTableLayout({})
    setResolvedTableLayout([])
  })

  it('keeps a valid color from layout.json', () => {
    expect(parseTableLayout({ users: { x: 1, y: 2, color: 'teal' } })).toEqual({
      users: { x: 1, y: 2, color: 'teal' },
    })
  })

  it('drops an unknown color instead of trusting it', () => {
    expect(
      parseTableLayout({ users: { x: 1, y: 2, color: 'chartreuse' } }),
    ).toEqual({ users: { x: 1, y: 2, color: undefined } })
  })

  it('survives dragging the table it is set on', () => {
    setBaseTableLayout({ users: { x: 1, y: 2 } })
    setResolvedTableLayout([node('users', 1, 2)])
    setTableColor('users', 'gold')

    rememberTablePositions([node('users', 50, 60)])

    expect(getTableColor('users')).toBe('gold')
    expect(dumpTableLayout()['users']).toEqual({ x: 50, y: 60, color: 'gold' })
  })

  it('clears back to no color', () => {
    setResolvedTableLayout([node('users', 0, 0)])
    setTableColor('users', 'red')
    setTableColor('users', null)

    expect(getTableColor('users')).toBeUndefined()
  })
})

describe(renameTableInLayout, () => {
  beforeEach(() => {
    setBaseTableLayout({})
    setResolvedTableLayout([])
  })

  it('renames the entries carried by a link', () => {
    expect(
      renameTableInLayout('users', 'accounts', {
        positions: ['users:10:20', 'orders:1:2'],
        colors: ['users:gold', 'orders:red'],
      }),
    ).toEqual({
      positions: ['accounts:10:20', 'orders:1:2'],
      colors: ['accounts:gold', 'orders:red'],
    })
  })

  it('renames a position that only layout.json pinned', () => {
    // getEffectiveTableLayout merges rather than first-wins, so a table pinned
    // only by the shipped file still has to follow the rename.
    setBaseTableLayout({ users: { x: 7, y: 8 } })

    renameTableInLayout('users', 'accounts', { positions: [], colors: [] })

    expect(getEffectiveTableLayout()['accounts']).toEqual({ x: 7, y: 8 })
    expect(getEffectiveTableLayout()['users']).toBeUndefined()
  })

  it('renames the resolved snapshot', () => {
    setResolvedTableLayout([node('users', 3, 4)])
    setTableColor('users', 'gold')

    renameTableInLayout('users', 'accounts', { positions: [], colors: [] })

    expect(getTableColor('accounts')).toBe('gold')
    expect(getTableColor('users')).toBeUndefined()
    expect(dumpTableLayout()['accounts']).toEqual({ x: 3, y: 4, color: 'gold' })
  })

  it('leaves everything alone when the table is not pinned anywhere', () => {
    expect(
      renameTableInLayout('ghost', 'spectre', {
        positions: ['users:1:2'],
        colors: ['users:gold'],
      }),
    ).toEqual({ positions: ['users:1:2'], colors: ['users:gold'] })
  })
})
