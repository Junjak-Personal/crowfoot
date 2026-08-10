import { aSchema, aTable } from '@crowfoot/schema/schema'
import * as v from 'valibot'
import { describe, expect, it } from 'vitest'
import {
  connectedComponents,
  planSchema,
  skeletonPlan,
  unrelatedTables,
} from './plan.js'

const fk = (name: string, column: string, target: string) => ({
  [name]: {
    type: 'FOREIGN KEY' as const,
    name,
    columnNames: [column],
    targetTableName: target,
    targetColumnNames: ['id'],
    updateConstraint: 'NO_ACTION' as const,
    deleteConstraint: 'NO_ACTION' as const,
  },
})

/** users <- posts <- comments, and an island of one that references nothing. */
const schema = aSchema({
  tables: {
    users: aTable({ name: 'users' }),
    posts: aTable({
      name: 'posts',
      constraints: fk('fk_posts', 'user_id', 'users'),
    }),
    comments: aTable({
      name: 'comments',
      constraints: fk('fk_comments', 'post_id', 'posts'),
    }),
    tags: aTable({ name: 'tags', constraints: fk('fk_tags', 'a', 'labels') }),
    labels: aTable({ name: 'labels' }),
    audit_log: aTable({ name: 'audit_log' }),
  },
})

describe('connectedComponents', () => {
  it('gathers tables a foreign key path can reach', () => {
    expect(connectedComponents(schema)).toEqual([
      ['comments', 'posts', 'users'],
      ['labels', 'tags'],
      ['audit_log'],
    ])
  })

  it('puts the largest island first', () => {
    const sizes = connectedComponents(schema).map((island) => island.length)
    expect(sizes).toEqual([...sizes].sort((a, b) => b - a))
  })

  it('survives a table pointing at itself', () => {
    const selfReferencing = aSchema({
      tables: {
        nodes: aTable({
          name: 'nodes',
          constraints: fk('fk_parent', 'parent_id', 'nodes'),
        }),
      },
    })

    expect(connectedComponents(selfReferencing)).toEqual([['nodes']])
  })

  it('ignores a foreign key pointing at a table that is not there', () => {
    const dangling = aSchema({
      tables: {
        orders: aTable({
          name: 'orders',
          constraints: fk('fk_missing', 'x', 'nowhere'),
        }),
      },
    })

    expect(connectedComponents(dangling)).toEqual([['orders']])
  })

  it('has nothing to say about an empty schema', () => {
    expect(connectedComponents(aSchema({ tables: {} }))).toEqual([])
  })
})

describe('unrelatedTables', () => {
  it('names the tables no foreign key touches', () => {
    expect(unrelatedTables(schema)).toEqual(['audit_log'])
  })
})

describe('skeletonPlan', () => {
  it('carries every related table, and leaves the unrelated ones out', () => {
    const plan = skeletonPlan(schema)
    const planned = plan.groups.flatMap((group) => group.tables)

    expect(planned.sort()).toEqual([
      'comments',
      'labels',
      'posts',
      'tags',
      'users',
    ])
    expect(planned).not.toContain('audit_log')
  })

  it('validates against the plan schema it is meant to seed', () => {
    expect(() => v.parse(planSchema, skeletonPlan(schema))).not.toThrow()
  })

  it('names groups so nobody mistakes them for a decision', () => {
    expect(skeletonPlan(schema).groups[0]?.name).toMatch(/rename/i)
  })

  it('gives each group a different colour from the palette', () => {
    const colors = skeletonPlan(schema).groups.map((group) => group.color)
    expect(new Set(colors).size).toBe(colors.length)
  })
})

describe('planSchema', () => {
  it('rejects a colour the viewer would silently drop', () => {
    const bad = {
      groups: [{ id: 'a', name: 'A', color: 'chartreuse', tables: [] }],
    }
    expect(() => v.parse(planSchema, bad)).toThrow()
  })

  it('accepts a plan with no memos at all', () => {
    expect(() =>
      v.parse(planSchema, {
        groups: [{ id: 'a', name: 'A', tables: ['users'] }],
      }),
    ).not.toThrow()
  })

  it('rejects a memo with no text', () => {
    expect(() =>
      v.parse(planSchema, { groups: [], memos: [{ text: '' }] }),
    ).toThrow()
  })
})
