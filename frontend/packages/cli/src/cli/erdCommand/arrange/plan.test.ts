import { aSchema, aTable } from '@crowfoot/schema/schema'
import * as v from 'valibot'
import { describe, expect, it } from 'vitest'
import { planSchema, skeletonPlan, unrelatedTables } from './plan.js'

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

/** Everything hangs off `users`, so there is exactly one foreign-key island. */
const schema = aSchema({
  tables: {
    users: aTable({ name: 'users' }),
    posts: aTable({
      name: 'posts',
      constraints: fk('fk_posts', 'user_id', 'users'),
    }),
    post_tags: aTable({
      name: 'post_tags',
      constraints: fk('fk_post_tags', 'post_id', 'posts'),
    }),
    post_stats: aTable({
      name: 'post_stats',
      constraints: fk('fk_post_stats', 'post_id', 'posts'),
    }),
    mail_template: aTable({
      name: 'mail_template',
      constraints: fk('fk_mail_template', 'user_id', 'users'),
    }),
    mail_log: aTable({
      name: 'mail_log',
      constraints: fk('fk_mail_log', 'user_id', 'users'),
    }),
    audit_log: aTable({ name: 'audit_log' }),
    audit_trail: aTable({ name: 'audit_trail' }),
  },
})

describe('unrelatedTables', () => {
  it('names the tables no foreign key touches', () => {
    expect(unrelatedTables(schema)).toEqual(['audit_log', 'audit_trail'])
  })
})

describe('skeletonPlan', () => {
  it('clusters tables that share the first word of their name', () => {
    const plan = skeletonPlan(schema)
    const clusters = plan.groups.map((group) => group.tables)

    expect(clusters).toContainEqual(['post_stats', 'post_tags'])
  })

  it('leaves a prefix only one table has for the caller to place', () => {
    const planned = skeletonPlan(schema).groups.flatMap((group) => group.tables)

    expect(planned).not.toContain('users')
  })

  /**
   * `arrange` cannot give one a coordinate, but that is a fact about the
   * viewer's layout and not about which context the table belongs to. Leaving
   * them out hid from the reader that they could be grouped at all.
   */
  it('clusters tables with no foreign key like any other', () => {
    const clusters = skeletonPlan(schema).groups.map((group) => group.tables)

    expect(clusters).toContainEqual(['audit_log', 'audit_trail'])
  })

  it('puts the biggest cluster first', () => {
    const sizes = skeletonPlan(schema).groups.map(
      (group) => group.tables.length,
    )
    expect(sizes).toEqual([...sizes].sort((a, b) => b - a))
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

  /**
   * A hub table joins everything into one foreign-key island, which is why the
   * grouping is not built from those.
   */
  it('still separates a schema every table is transitively joined to', () => {
    expect(skeletonPlan(schema).groups.length).toBeGreaterThan(1)
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
