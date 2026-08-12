// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import * as v from 'valibot'
import { ArgumentError, type CliError, FileSystemError } from '../../errors.js'
import { arrange } from '../arrange/arrange.js'
import { planSchema } from '../arrange/plan.js'
import { readSchema } from '../arrange/readSchema.js'

const readPlan = (path: string) => {
  if (!path) throw new ArgumentError('--plan is required')

  let raw: string
  try {
    raw = readFileSync(resolve(path), 'utf8')
  } catch {
    throw new ArgumentError(
      `Could not read ${path}. Write one with \`crowfoot erd plan\`.`,
    )
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new ArgumentError(`${path} is not JSON.`)
  }

  const result = v.safeParse(planSchema, parsed)
  if (!result.success) {
    const issues = result.issues
      .map(
        (issue) =>
          `  ${issue.path?.map((p) => p.key).join('.') ?? '(root)'}: ${issue.message}`,
      )
      .join('\n')
    throw new ArgumentError(`${path} is not a valid plan:\n${issues}`)
  }

  return result.output
}

/**
 * Turns a plan into `layout.json`, `groups.json` and `memos.json`.
 *
 * Written next to `schema.json` because that is where the viewer looks for
 * them — the same three files `erd from-link` writes, so whatever copies them
 * into a deploy does not change.
 */
export const arrangeCommand = async (
  inputPath: string,
  planPath: string,
  outDir: string,
): Promise<CliError[]> => {
  const schema = readSchema(inputPath)
  const plan = readPlan(planPath)
  const result = arrange(schema, plan)

  const resolvedOutDir = resolve(outDir)
  const write = (name: string, data: unknown) =>
    writeFileSync(
      join(resolvedOutDir, name),
      `${JSON.stringify(data, null, 2)}\n`,
    )

  try {
    mkdirSync(resolvedOutDir, { recursive: true })
    write('layout.json', result.layout)
    write('groups.json', result.groups)
    write('memos.json', result.memos)
  } catch (error) {
    return [new FileSystemError(`Error writing files: ${error}`)]
  }

  const placed = Object.keys(result.layout).length
  console.info(
    `\nWrote layout.json (${placed} tables), groups.json (${result.groups.length} groups) ` +
      `and memos.json (${result.memos.length} memos) to \`${outDir}/\`.`,
  )

  if (result.unplaceable.length > 0) {
    const grouped = result.unplaceable.filter((table) =>
      plan.groups.some((group) => group.tables.includes(table)),
    )

    console.info(
      `\n${result.unplaceable.length} table(s) have no foreign key and are not in layout.json:\n` +
        `  ${result.unplaceable.join(', ')}\n` +
        'The viewer gathers those into a group of its own and places them itself.' +
        (grouped.length > 0
          ? `\n${grouped.length} of them are in a group you planned: ${grouped.join(', ')}. ` +
            'The membership is kept, but the box stretches to wherever the viewer ' +
            'put them until you drag them into place.'
          : ''),
    )
  }

  return []
}
