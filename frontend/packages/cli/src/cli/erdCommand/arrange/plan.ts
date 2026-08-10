// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import type { Schema } from '@crowfoot/schema/schema'
import * as v from 'valibot'

/**
 * The palette the viewer accepts. Anything else is dropped on load without a
 * word, so a plan naming a colour that does not exist is rejected here instead.
 * Kept in step with `erd-core/src/features/erd/utils/viewColor/viewColor.ts`.
 */
const PALETTE = [
  'green',
  'mint',
  'teal',
  'sky',
  'blue',
  'steel',
  'sand',
  'yellow',
  'gold',
  'orange',
  'vermilion',
  'red',
] as const

const colorSchema = v.picklist(PALETTE)

/**
 * What an agent writes.
 *
 * There is no coordinate anywhere in here, and that is the point: positions are
 * the part that is wrong by default and silent about it. The plan carries
 * meaning — which tables belong together, what to call the grouping, what to say
 * about it — and `arrange` works out where everything goes.
 */
export const planSchema = v.object({
  groups: v.array(
    v.object({
      id: v.pipe(v.string(), v.minLength(1)),
      name: v.pipe(v.string(), v.minLength(1)),
      color: v.optional(colorSchema),
      tables: v.array(v.pipe(v.string(), v.minLength(1))),
    }),
  ),
  memos: v.optional(
    v.array(
      v.object({
        text: v.pipe(v.string(), v.minLength(1)),
        color: v.optional(colorSchema),
        /** Width in memo columns. Defaults to 1. */
        span: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
        fontSize: v.optional(
          v.pipe(v.number(), v.integer(), v.minValue(8), v.maxValue(120)),
        ),
      }),
    ),
  ),
})

export type Plan = v.InferOutput<typeof planSchema>

/** Table names on both ends of every foreign key. */
const relationshipPairs = (schema: Schema): [string, string][] => {
  const pairs: [string, string][] = []

  for (const [name, table] of Object.entries(schema.tables)) {
    for (const constraint of Object.values(table.constraints)) {
      if (constraint.type !== 'FOREIGN KEY') continue
      pairs.push([name, constraint.targetTableName])
    }
  }

  return pairs
}

/**
 * Tables joined by foreign keys, one array per island, each sorted by name and
 * the islands themselves ordered by size — the biggest is usually the core of
 * the schema and reads best on the left.
 *
 * A table with no foreign key at all is its own island of one, and the caller
 * has to keep those out of the layout: the viewer parents them to a group of its
 * own, which puts their coordinates in a different frame.
 */
export const connectedComponents = (schema: Schema): string[][] => {
  const parent = new Map<string, string>()
  const find = (name: string): string => {
    const seen: string[] = []
    let current = name
    while (
      parent.get(current) !== undefined &&
      parent.get(current) !== current
    ) {
      seen.push(current)
      current = parent.get(current) ?? current
    }
    for (const node of seen) parent.set(node, current)
    return current
  }

  for (const name of Object.keys(schema.tables)) parent.set(name, name)

  for (const [left, right] of relationshipPairs(schema)) {
    if (!parent.has(left) || !parent.has(right)) continue
    const a = find(left)
    const b = find(right)
    if (a !== b) parent.set(a, b)
  }

  const islands = new Map<string, string[]>()
  for (const name of Object.keys(schema.tables)) {
    const root = find(name)
    islands.set(root, [...(islands.get(root) ?? []), name])
  }

  return Array.from(islands.values())
    .map((names) => [...names].sort())
    .sort(
      (a, b) => b.length - a.length || (a[0] ?? '').localeCompare(b[0] ?? ''),
    )
}

/** Tables with no foreign key on either end. */
export const unrelatedTables = (schema: Schema): string[] => {
  const related = new Set(relationshipPairs(schema).flat())
  return Object.keys(schema.tables)
    .filter((name) => !related.has(name))
    .sort()
}

/**
 * A plan with every table name already in it, grouped by foreign-key island.
 *
 * The grouping is a starting point, not a claim: islands are what the schema
 * says, and naming them is the part only a reader of the code can do. The names
 * here say so.
 */
export const skeletonPlan = (schema: Schema): Plan => {
  const unrelated = new Set(unrelatedTables(schema))
  const groups = connectedComponents(schema)
    .map((tables) => tables.filter((name) => !unrelated.has(name)))
    .filter((tables) => tables.length > 0)
    .map((tables, index) => ({
      id: `group-${index + 1}`,
      name: `Rename me ${index + 1}`,
      color: PALETTE[index % PALETTE.length] ?? 'sky',
      tables,
    }))

  return { groups, memos: [] }
}
