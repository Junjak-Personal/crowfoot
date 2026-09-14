import type { Schema } from '../schema/index.js'
import type { ProcessError } from './errors.js'

/** A column's `DEFAULT` that was read and could not be represented. */
type UnparsedDefault = {
  clause: 'DEFAULT'
  table: string
  column: string
  /** The source text that was dropped, as it was written. */
  raw: string
}

/**
 * A statement that changes something the schema draws — a column, an index, a
 * constraint, an enum — which was read and not applied to it.
 *
 * The parser reads a schema rather than replaying one, so a migration that
 * alters an earlier statement leaves the earlier version standing. Every count
 * comes out right and the diagram is of a database that no longer exists.
 */
type UnparsedStatement = {
  clause: 'STATEMENT'
  /** The statement, as it was written. */
  raw: string
}

/**
 * Something the parser read but could not represent, named where it was found.
 *
 * Distinct from `errors`: nothing failed. The schema is written, every count
 * comes out right, and something is quietly missing from it — which is the one
 * kind of loss counting the output cannot find. Saying so is the whole point.
 */
export type Unparsed = UnparsedDefault | UnparsedStatement

export type ProcessResult = {
  value: Schema
  errors: ProcessError[]
  unparsed: Unparsed[]
}

export type Processor = (
  str: string,
  chunkSize?: number,
) => Promise<ProcessResult>
