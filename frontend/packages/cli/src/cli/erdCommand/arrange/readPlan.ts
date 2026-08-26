// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import * as v from 'valibot'
import { ArgumentError } from '../../errors.js'
import { type Plan, planSchema } from './plan.js'

/**
 * Reads a plan written by `erd plan` and edited by hand.
 *
 * `flag` names the option it came from, because two commands take one: it is
 * `--plan` to `arrange` and `--update` to `plan`, and being told the wrong flag
 * is missing is worse than being told nothing.
 */
export const readPlan = (path: string, flag: string): Plan => {
  if (!path) throw new ArgumentError(`${flag} is required`)

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
