import { aColumn, aSchema, aTable } from '@crowfoot/schema/schema'
import { describe, expect, it } from 'vitest'
import { arrange } from './arrange.js'
import { TABLE_WIDTH } from './geometry.js'

const fk = (name: string, target: string) => ({
  [name]: {
    type: 'FOREIGN KEY' as const,
    name,
    columnNames: ['x'],
    targetTableName: target,
    targetColumnNames: ['id'],
    updateConstraint: 'NO_ACTION' as const,
    deleteConstraint: 'NO_ACTION' as const,
  },
})

const withColumns = (name: string, count: number, constraints = {}) =>
  aTable({
    name,
    columns: Object.fromEntries(
      Array.from({ length: count }, (_, i) => [
        `c${i}`,
        aColumn({ name: `c${i}` }),
      ]),
    ),
    constraints,
  })

const schema = aSchema({
  tables: {
    users: withColumns('users', 3),
    posts: withColumns('posts', 5, fk('fk_posts', 'users')),
    loose: withColumns('loose', 2),
  },
})

const plan = {
  groups: [
    {
      id: 'core',
      name: 'Core',
      color: 'sky' as const,
      tables: ['users', 'posts'],
    },
  ],
  memos: [{ text: 'hello', color: 'gold' as const }],
}

describe('arrange', () => {
  /**
   * Including the ones with no relationship. They used to be left out — the
   * viewer parented them to a container of its own and read their position in
   * its frame, so a coordinate written here landed somewhere else. The viewer
   * takes a table out of that container the moment something places it.
   */
  it('places every table in the schema', () => {
    const result = arrange(schema, plan)

    expect(Object.keys(result.layout).sort()).toEqual([
      'loose',
      'posts',
      'users',
    ])
  })

  it('places a relationship-less table in the group the plan put it in', () => {
    const result = arrange(schema, {
      groups: [
        { id: 'core', name: 'Core', tables: ['users', 'posts', 'loose'] },
      ],
    })

    expect(result.groups[0]?.tableNames).toEqual(['users', 'posts', 'loose'])
    expect(result.layout['loose']).toBeDefined()
  })

  /** Nothing is held back any more, so the first table starts at the origin. */
  it('starts at the origin rather than clearing a reserved band', () => {
    const result = arrange(schema, plan)

    expect(result.layout['users']).toEqual({ x: 0, y: 0 })
  })

  it('sizes tables from their column count', () => {
    const result = arrange(schema, plan)
    // users has 3 columns: 52 + 3 * 34 = 154, plus the 40 stack gap.
    expect(result.layout['posts']?.y).toBe(194)
  })

  it('puts a memo above the tables, never over them', () => {
    const result = arrange(schema, plan)
    const memo = result.memos[0]

    expect(memo).toBeDefined()
    expect((memo?.y ?? 0) + (memo?.height ?? 0)).toBeLessThan(0)
  })

  it('gives a memo a height its text fits inside', () => {
    const result = arrange(schema, {
      groups: plan.groups,
      memos: [{ text: 'a\nb\nc\nd\ne\nf\ng\nh' }],
    })

    expect(result.memos[0]?.height).toBeGreaterThan(8 * 32)
  })

  it('produces the same ids every run, so a re-run diffs to nothing', () => {
    expect(arrange(schema, plan).memos[0]?.id).toBe(
      arrange(schema, plan).memos[0]?.id,
    )
  })

  it('refuses a plan naming a table the schema does not have', () => {
    expect(() =>
      arrange(schema, { groups: [{ id: 'a', name: 'A', tables: ['ghost'] }] }),
    ).toThrow(/not in the schema/)
  })

  it('refuses two groups with the same id', () => {
    expect(() =>
      arrange(schema, {
        groups: [
          { id: 'dup', name: 'A', tables: [] },
          { id: 'dup', name: 'B', tables: [] },
        ],
      }),
    ).toThrow(/share the id/)
  })

  /**
   * `arrangeTables` writes one position per table, so the second group's
   * column would silently win and stretch the first group's box across the
   * diagram to reach it.
   */
  it('refuses a plan that puts one table in two groups', () => {
    expect(() =>
      arrange(schema, {
        groups: [
          { id: 'core', name: 'Core', tables: ['users', 'posts'] },
          { id: 'audit', name: 'Audit', tables: ['users'] },
        ],
      }),
    ).toThrow(/belongs to one group/)
  })

  it('places a table the plan forgot rather than dropping it', () => {
    const result = arrange(schema, {
      groups: [{ id: 'core', name: 'Core', tables: ['users'] }],
    })

    expect(result.layout['posts']).toBeDefined()
    expect(result.layout['posts']?.x).toBeGreaterThan(
      (result.layout['users']?.x ?? 0) + TABLE_WIDTH,
    )
  })
})
