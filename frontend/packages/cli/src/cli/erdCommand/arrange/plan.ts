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
 * Tables whose names start with the same word, biggest cluster first.
 *
 * Foreign-key islands were the obvious idea and they do not work: one hub table
 * — `users`, with a degree of 32 in the schema this was tested against — welds a
 * real application's tables into a single component. That schema came out as one
 * group of 74. Prefixes cut the same schema into `estimate_*` (15),
 * `template_*` (11), `parsing_*` (6) and ten more, because tables are named
 * after the thing they belong to.
 *
 * A prefix only one table has is not a cluster, so those are left out for the
 * caller to place. None of this is a claim about the design — it is a way to
 * start with the names already typed.
 */
const prefixClusters = (tables: string[]): string[][] => {
  const byPrefix = new Map<string, string[]>()

  for (const table of tables) {
    const prefix = table.split('_')[0] ?? table
    byPrefix.set(prefix, [...(byPrefix.get(prefix) ?? []), table])
  }

  return Array.from(byPrefix.entries())
    .filter(([, names]) => names.length > 1)
    .sort(
      ([leftPrefix, left], [rightPrefix, right]) =>
        right.length - left.length || leftPrefix.localeCompare(rightPrefix),
    )
    .map(([, names]) => [...names].sort())
}

/** Tables with no foreign key on either end. */
export const unrelatedTables = (schema: Schema): string[] => {
  const related = new Set(relationshipPairs(schema).flat())
  return Object.keys(schema.tables)
    .filter((name) => !related.has(name))
    .sort()
}

/**
 * A plan with every table name already in it, clustered by shared prefix.
 *
 * The grouping is a starting point, not a claim: the prefixes are what the
 * schema says, and naming them is the part only a reader of the code can do.
 * The names here say so.
 *
 * A table with no foreign key is clustered like any other. It is the one thing
 * `arrange` cannot place — the viewer parents it to a group of its own — but
 * having no relationship says nothing about which context it belongs to, and
 * leaving it out of the skeleton hid from the reader that it could be grouped
 * at all.
 */
export const skeletonPlan = (schema: Schema): Plan => {
  const groups = prefixClusters(Object.keys(schema.tables)).map(
    (tables, index) => ({
      id: `${tables[0]?.split('_')[0] ?? `group-${index + 1}`}`,
      name: `Rename me ${index + 1}`,
      color: PALETTE[index % PALETTE.length] ?? 'sky',
      tables,
    }),
  )

  return { groups, memos: [] }
}
