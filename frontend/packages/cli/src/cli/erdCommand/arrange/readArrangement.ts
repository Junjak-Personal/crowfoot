// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as v from 'valibot'
import { ArgumentError } from '../../errors.js'
import type { Layout } from './geometry.js'

/**
 * Only what a box is drawn from. `color` and anything a later viewer adds are
 * dropped on the way in — this reads these files, it never writes them back.
 */
const layoutFileSchema = v.record(
  v.string(),
  v.object({ x: v.number(), y: v.number() }),
)

const groupsFileSchema = v.array(
  v.object({
    id: v.string(),
    name: v.string(),
    tableNames: v.array(v.string()),
  }),
)

type ArrangementGroup = v.InferOutput<typeof groupsFileSchema>[number]

type Arrangement = {
  layout: Layout
  groups: ArrangementGroup[]
}

const read = <T>(path: string, schema: v.GenericSchema<unknown, T>): T => {
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    throw new ArgumentError(`${path} is not readable JSON.`)
  }

  const result = v.safeParse(schema, parsed)
  if (!result.success) {
    throw new ArgumentError(`${path} is not in the shape the viewer reads.`)
  }

  return result.output
}

/**
 * Reads the sidecar files a deploy actually serves.
 *
 * Deliberately not the output of a fresh `arrange`: that lays groups out
 * hundreds of units apart and its boxes can never cross, so checking it would
 * always pass. Boxes cross once someone has dragged tables around in edit mode,
 * and what they dragged is what these files hold.
 */
export const readArrangement = (outDir: string): Arrangement => {
  const layoutPath = join(outDir, 'layout.json')
  const groupsPath = join(outDir, 'groups.json')

  if (!existsSync(layoutPath)) {
    throw new ArgumentError(
      `No layout.json in \`${outDir}/\`. Point --output-dir at the files the viewer loads.`,
    )
  }

  return {
    layout: read(layoutPath, layoutFileSchema),
    groups: existsSync(groupsPath) ? read(groupsPath, groupsFileSchema) : [],
  }
}
