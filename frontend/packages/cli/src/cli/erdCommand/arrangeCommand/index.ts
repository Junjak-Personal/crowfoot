// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { ArgumentError, type CliError, FileSystemError } from '../../errors.js'
import { arrange } from '../arrange/arrange.js'
import { checkArrangement } from '../arrange/check.js'
import { readArrangement } from '../arrange/readArrangement.js'
import { readPlan } from '../arrange/readPlan.js'
import { readSchema } from '../arrange/readSchema.js'

const round = (value: number) => Math.round(value)

/**
 * Reports the diagram the deployed sidecar files make, and writes nothing.
 *
 * Two group boxes crossing is what reads as a broken diagram, and until this
 * the only way to see it was to open a browser and measure the DOM. The boxes
 * are derived from the numbers the viewer derives them from, so what this says
 * is what is drawn.
 */
const checkCommand = (
  schema: ReturnType<typeof readSchema>,
  outDir: string,
): CliError[] => {
  const { layout, groups } = readArrangement(outDir)
  const report = checkArrangement({ schema, layout, groups })

  console.info(`\n${report.groups.length} group box(es):`)
  for (const group of report.groups) {
    console.info(
      `  ${group.id} (${group.placed} placed)  ` +
        `${round(group.width)}x${round(group.height)} at ${round(group.x)},${round(group.y)}`,
    )
  }

  if (report.unplaced.length > 0) {
    console.info(
      `\n${report.unplaced.length} group member(s) with no position: ` +
        `${report.unplaced.join(', ')}\n` +
        'The viewer places those itself, and the box stretches to reach them — ' +
        'no box above accounts for that.',
    )
  }

  if (report.overlaps.length === 0) {
    console.info(
      '\nNo group boxes overlap. Nothing written — this was a check.',
    )
    return []
  }

  const lines = report.overlaps.map(
    ({ left, right, byX, byY }) =>
      `  ${left} and ${right} cross by ${round(byX)}x${round(byY)}`,
  )

  return [
    new ArgumentError(
      `${report.overlaps.length} pair(s) of group boxes overlap:\n${lines.join('\n')}\n` +
        'Drag a member out of the way in edit mode and run `erd from-link` again, ' +
        'or re-`arrange` from a plan that splits them.',
    ),
  ]
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
  check = false,
): Promise<CliError[]> => {
  const schema = readSchema(inputPath)

  // Before the plan is read: `--check` looks at what is deployed, and needs no
  // plan at all.
  if (check) return checkCommand(schema, outDir)

  const plan = readPlan(planPath, '--plan')
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
