import { aSchema, aTable } from '@crowfoot/schema/schema'
import * as v from 'valibot'
import { describe, expect, it } from 'vitest'
import type { Plan } from './plan.js'
import { planSchema, skeletonPlan, updatePlan } from './plan.js'

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

/**
 * A plan naming a table the schema no longer has stops `arrange` outright, so
 * before this the choice past a hundred tables was hand-editing JSON or
 * starting the grouping over. Every decision already made has to survive.
 */
describe('updatePlan', () => {
  const schemaOf = (...names: string[]) =>
    aSchema({
      tables: Object.fromEntries(names.map((name) => [name, aTable({ name })])),
    })

  const planOf = (groups: Plan['groups']): Plan => ({ groups, memos: [] })

  it('keeps the grouping and drops only what the schema lost', () => {
    const { plan, removed, added } = updatePlan(
      planOf([
        {
          id: 'billing',
          name: 'Billing',
          color: 'gold',
          tables: ['orders', 'invoices'],
        },
        { id: 'people', name: 'People', tables: ['users'] },
      ]),
      schemaOf('orders', 'users'),
    )

    expect(plan.groups).toEqual([
      { id: 'billing', name: 'Billing', color: 'gold', tables: ['orders'] },
      { id: 'people', name: 'People', tables: ['users'] },
    ])
    expect(removed).toEqual(['invoices'])
    expect(added).toEqual([])
  })

  /** An empty group is not a group — the viewer would draw a box around nothing. */
  it('drops a group the schema emptied, and says which', () => {
    const { plan, emptied } = updatePlan(
      planOf([
        { id: 'billing', name: 'Billing', tables: ['invoices'] },
        { id: 'people', name: 'People', tables: ['users'] },
      ]),
      schemaOf('users'),
    )

    expect(plan.groups.map((group) => group.id)).toEqual(['people'])
    expect(emptied).toEqual(['billing'])
  })

  it('puts a table the plan never named into "unassigned"', () => {
    const { plan, added } = updatePlan(
      planOf([{ id: 'people', name: 'People', tables: ['users'] }]),
      schemaOf('users', 'sessions', 'audit_log'),
    )

    expect(plan.groups).toEqual([
      { id: 'people', name: 'People', tables: ['users'] },
      {
        id: 'unassigned',
        name: 'Unassigned',
        tables: ['audit_log', 'sessions'],
      },
    ])
    expect(added).toEqual(['audit_log', 'sessions'])
  })

  /** Two groups with one id is a plan `arrange` refuses. */
  it('appends to the unassigned group already there', () => {
    const { plan } = updatePlan(
      planOf([{ id: 'unassigned', name: 'Unassigned', tables: ['sessions'] }]),
      schemaOf('sessions', 'audit_log'),
    )

    expect(plan.groups).toEqual([
      {
        id: 'unassigned',
        name: 'Unassigned',
        tables: ['sessions', 'audit_log'],
      },
    ])
  })

  it('adds no group when nothing was gained', () => {
    const { plan, added, removed } = updatePlan(
      planOf([{ id: 'people', name: 'People', tables: ['users'] }]),
      schemaOf('users'),
    )

    expect(plan.groups.map((group) => group.id)).toEqual(['people'])
    expect(added).toEqual([])
    expect(removed).toEqual([])
  })

  it('carries the memos through untouched', () => {
    const memos = [{ text: 'Read this first', span: 2 }]

    expect(
      updatePlan(
        {
          groups: [{ id: 'people', name: 'People', tables: ['users'] }],
          memos,
        },
        schemaOf('users', 'sessions'),
      ).plan.memos,
    ).toEqual(memos)
  })

  /** The output is a plan, so it has to be one `arrange` will read back. */
  it('produces a plan that validates', () => {
    const { plan } = updatePlan(
      planOf([{ id: 'people', name: 'People', tables: ['users'] }]),
      schemaOf('users', 'sessions'),
    )

    expect(v.safeParse(planSchema, plan).success).toBe(true)
  })
})
