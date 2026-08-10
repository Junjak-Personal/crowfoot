// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { type Schema, schemaSchema } from '@crowfoot/schema/schema'
import * as v from 'valibot'
import { ArgumentError } from '../../errors.js'

/**
 * Reads the `schema.json` that `erd build` wrote.
 *
 * Both of these commands run after a build rather than instead of one, so this
 * takes the built artifact rather than re-parsing a source file — one code path,
 * and the agent is looking at exactly what the viewer will.
 */
export const readSchema = (path: string): Schema => {
  if (!path) throw new ArgumentError('--input is required')

  let raw: string
  try {
    raw = readFileSync(resolve(path), 'utf8')
  } catch {
    throw new ArgumentError(
      `Could not read ${path}. Point --input at the schema.json that \`erd build\` wrote.`,
    )
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new ArgumentError(`${path} is not JSON.`)
  }

  const result = v.safeParse(schemaSchema, parsed)
  if (!result.success) {
    throw new ArgumentError(
      `${path} is not a crowfoot schema.json. Run \`erd build\` first.`,
    )
  }

  return result.output
}
