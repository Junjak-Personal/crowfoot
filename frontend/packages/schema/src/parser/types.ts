import type { Schema } from '../schema/index.js'
import type { ProcessError } from './errors.js'

/**
 * Something the parser read but could not represent, named where it was found.
 *
 * Distinct from `errors`: nothing failed. The schema is written, every count
 * comes out right, and a clause is quietly missing from it — which is the one
 * kind of loss counting the output cannot find. Saying so is the whole point.
 */
export type Unparsed = {
  table: string
  column: string
  /** Which part of the definition the text came from. */
  clause: 'DEFAULT'
  /** The source text that was dropped, as it was written. */
  raw: string
}

export type ProcessResult = {
  value: Schema
  errors: ProcessError[]
  unparsed: Unparsed[]
}

export type Processor = (
  str: string,
  chunkSize?: number,
) => Promise<ProcessResult>
