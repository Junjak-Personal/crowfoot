// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import type { CliError } from '../../errors.js'
import { skeletonPlan, unrelatedTables, updatePlan } from '../arrange/plan.js'
import { readPlan } from '../arrange/readPlan.js'
import { readSchema } from '../arrange/readSchema.js'

/** What `--update` did, for the reader; the plan itself goes to stdout. */
const reportUpdate = (
  inputPath: string,
  { removed, added, emptied }: ReturnType<typeof updatePlan>,
): void => {
  if (removed.length > 0) {
    console.error(
      `\nDropped, no longer in the schema (${removed.length}): ${removed.join(', ')}`,
    )
  }

  if (emptied.length > 0) {
    console.error(
      `Groups dropped with their last table (${emptied.length}): ${emptied.join(', ')}`,
    )
  }

  if (added.length > 0) {
    console.error(
      `\nNew, put in "unassigned" (${added.length}): ${added.join(', ')}\n` +
        'Move them into the groups they belong to — a table left there is grouped\n' +
        'with everything else nobody has looked at yet.',
    )
  }

  if (removed.length === 0 && added.length === 0) {
    console.error('\nThe plan already matches the schema. Nothing changed.')
  }

  console.error(
    '\nThen:\n' +
      `  crowfoot erd arrange --input ${inputPath} --plan plan.json`,
  )
}

/** What a fresh plan says about itself. */
const reportSkeleton = (
  inputPath: string,
  schema: Parameters<typeof unrelatedTables>[0],
  groupCount: number,
): void => {
  const unrelated = unrelatedTables(schema)
  if (unrelated.length > 0) {
    console.error(
      `\nLeft out of the plan (${unrelated.length}): ${unrelated.join(', ')}\n` +
        'These have no foreign key, so the viewer collects them into a group of its\n' +
        'own and places them itself. Nothing here can position them.',
    )
  }

  console.error(
    `\n${groupCount} group(s) suggested from shared name prefixes.\n` +
      'Rename them, move tables between them, add memos, then:\n' +
      `  crowfoot erd arrange --input ${inputPath} --plan plan.json`,
  )
}

/**
 * Prints a plan with every table name already in it.
 *
 * The point is that whoever edits it — usually an agent — never has to type a
 * table name, and so cannot get one wrong. The grouping is by shared name
 * prefix, which is a starting point rather than an opinion; the group names say
 * so.
 *
 * With `--update` it prints the plan given to it, brought back in step with the
 * schema: tables the schema no longer has are dropped, and ones it has gained
 * are put in a group named `unassigned`. Every grouping decision already made
 * survives — which is the difference between editing a hundred-table plan and
 * starting it again.
 *
 * Notes go to stderr so `> plan.json` gets only the plan.
 */
export const planCommand = async (
  inputPath: string,
  updatePath?: string,
): Promise<CliError[]> => {
  const schema = readSchema(inputPath)

  if (updatePath === undefined) {
    const plan = skeletonPlan(schema)
    process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`)
    reportSkeleton(inputPath, schema, plan.groups.length)
    return []
  }

  const update = updatePlan(readPlan(updatePath, '--update'), schema)
  process.stdout.write(`${JSON.stringify(update.plan, null, 2)}\n`)
  reportUpdate(inputPath, update)

  return []
}
