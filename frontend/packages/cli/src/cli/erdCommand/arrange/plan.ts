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

/**
 * Where a table the plan has never seen goes.
 *
 * A group rather than a silent omission: a table missing from the plan is a
 * table `arrange` will not place, and the diagram is quietly worse for it. Put
 * somewhere named, it is a question the next edit has to answer.
 */
const UNASSIGNED_GROUP_ID = 'unassigned'

type PlanUpdate = {
  plan: Plan
  /** Named by the plan, gone from the schema. */
  removed: string[]
  /** In the schema, never named by the plan. */
  added: string[]
  /** Groups whose every table was removed. */
  emptied: string[]
}

/**
 * Brings a plan back in step with a schema that moved underneath it.
 *
 * Editing one by hand stops being possible somewhere around a hundred tables,
 * and a plan naming a table the schema no longer has stops `arrange` outright —
 * so the choice was between hand-editing JSON and starting the grouping over.
 *
 * Every grouping decision already made is kept. A group is only dropped when
 * the schema took its last table away; an empty group is not a group, and the
 * viewer would draw a box around nothing.
 */
export const updatePlan = (plan: Plan, schema: Schema): PlanUpdate => {
  const live = new Set(Object.keys(schema.tables))
  const planned = new Set(plan.groups.flatMap((group) => group.tables))

  const removed = [...planned].filter((name) => !live.has(name)).sort()
  const added = [...live].filter((name) => !planned.has(name)).sort()

  const kept = plan.groups.map((group) => ({
    ...group,
    tables: group.tables.filter((name) => live.has(name)),
  }))

  const emptied = kept
    .filter((group) => group.tables.length === 0)
    .map((group) => group.id)

  const groups = kept.filter((group) => group.tables.length > 0)

  if (added.length === 0) {
    return { plan: { ...plan, groups }, removed, added, emptied }
  }

  // Appended to the one already there rather than adding a second: two groups
  // with the same id is a plan `arrange` refuses.
  const unassigned = groups.find((group) => group.id === UNASSIGNED_GROUP_ID)

  return {
    plan: {
      ...plan,
      groups: unassigned
        ? groups.map((group) =>
            group.id === UNASSIGNED_GROUP_ID
              ? { ...group, tables: [...group.tables, ...added] }
              : group,
          )
        : [
            ...groups,
            { id: UNASSIGNED_GROUP_ID, name: 'Unassigned', tables: added },
          ],
    },
    removed,
    added,
    emptied,
  }
}
