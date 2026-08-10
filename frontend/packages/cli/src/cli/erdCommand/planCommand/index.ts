// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import type { CliError } from '../../errors.js'
import { skeletonPlan, unrelatedTables } from '../arrange/plan.js'
import { readSchema } from '../arrange/readSchema.js'

/**
 * Prints a plan with every table name already in it.
 *
 * The point is that whoever edits it — usually an agent — never has to type a
 * table name, and so cannot get one wrong. The grouping is the schema's own
 * foreign-key islands, which is a starting point rather than an opinion; the
 * group names say so.
 *
 * Notes go to stderr so `> plan.json` gets only the plan.
 */
export const planCommand = async (inputPath: string): Promise<CliError[]> => {
  const schema = readSchema(inputPath)
  const plan = skeletonPlan(schema)

  process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`)

  const unrelated = unrelatedTables(schema)
  if (unrelated.length > 0) {
    console.error(
      `\nLeft out of the plan (${unrelated.length}): ${unrelated.join(', ')}\n` +
        'These have no foreign key, so the viewer collects them into a group of its\n' +
        'own and places them itself. Nothing here can position them.',
    )
  }

  console.error(
    `\n${plan.groups.length} group(s) suggested from foreign-key islands.\n` +
      'Rename them, move tables between them, add memos, then:\n' +
      `  crowfoot erd arrange --input ${inputPath} --plan plan.json`,
  )

  return []
}
