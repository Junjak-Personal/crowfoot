import { type InferIssue, safeParse } from 'valibot'
import type { Schema } from '../../../schema/index.js'
import { schemaSchema } from '../../../schema/index.js'
import { type ProcessError, UnexpectedTokenWarningError } from '../../errors.js'
import type { Processor, Unparsed } from '../../types.js'
import { convertToSchema } from './converter.js'
import { parse, sanitizePgDumpMetaCommands } from './parser.js'
import { type SqlStatement, splitStatements } from './splitStatements.js'

/**
 * How much SQL to hand the parser at once.
 *
 * Every `parse` builds its own WebAssembly instance with a 128MB heap, so one
 * statement per call would spend nearly all its time on setup. Batching pays
 * that once per group instead — and caps it, because the heap is what a very
 * large input exhausts. A batch never splits a statement, so the cap costs
 * nothing but an extra call.
 *
 * 20k was measured, not guessed: a 10,000-line schema reads in 290ms at this
 * size, and the parser aborts the whole process — not something catchable —
 * somewhere between here and 50k. The largest single statement across the
 * schemas this was tried on is about 5k, so the cap has room to spare.
 */
const BATCH_CHARACTERS = 20_000

type Batch = {
  /** Character index into the original SQL. */
  start: number
  end: number
  statements: SqlStatement[]
}

/** Groups consecutive statements up to the budget, never splitting one. */
const batchStatements = (
  statements: SqlStatement[],
  budget: number,
): Batch[] => {
  const batches: Batch[] = []

  for (const statement of statements) {
    const end = statement.start + statement.text.length
    const current = batches.at(-1)

    if (current === undefined || end - current.start > budget) {
      batches.push({ start: statement.start, end, statements: [statement] })
      continue
    }

    current.end = end
    current.statements.push(statement)
  }

  return batches
}

/**
 * Reads a schema from SQL.
 *
 * The input is cut into statements first and the parser is handed whole ones.
 * It used to be read in windows of N lines, which had no idea where a statement
 * began or ended: a statement straddling the edge of a window sent the reader
 * looking for a window size that happened to parse, and on a large file that
 * lost statements outright — 103 tables came back as 97, or as 11 at a
 * different window size, with nothing reported either time.
 *
 * Nothing is dropped quietly now. A batch that will not parse is retried a
 * statement at a time, so one bad statement costs only itself, and whatever is
 * left over is named in `unparsed` where `--strict` can refuse it.
 */
export const processor: Processor = async (
  input: string,
  batchCharacters = BATCH_CHARACTERS,
) => {
  // Before splitting, not inside the parse: a psql directive carries no
  // semicolon, so one left in place joins the statement under it and takes
  // that down too. Blanking keeps every offset where it was.
  const sql = sanitizePgDumpMetaCommands(input)
  const schema: Schema = { tables: {}, enums: {}, extensions: {} }
  const errors: ProcessError[] = []
  const unparsed: Unparsed[] = []
  /** Statements the parser rejected, as opposed to ones it read and could not apply. */
  const unreadable: string[] = []

  /** Parses one contiguous slice of the input into the schema being built. */
  const read = async (text: string, start: number): Promise<boolean> => {
    const { parse_tree, error } = await parse(text)
    if (error !== null) return false

    const { errors: conversionErrors, unparsed: slice } = convertToSchema(
      parse_tree.stmts,
      sql,
      schema,
      start,
      text,
    )

    errors.push(...conversionErrors)
    unparsed.push(...slice)

    return true
  }

  for (const batch of batchStatements(splitStatements(sql), batchCharacters)) {
    if (await read(sql.slice(batch.start, batch.end), batch.start)) continue

    // The batch holds something the parser will not take. Which statement it
    // is matters, so they go in one at a time rather than the whole group
    // being written off together.
    for (const statement of batch.statements) {
      if (await read(statement.text, statement.start)) continue

      unreadable.push(statement.text.trim())
      unparsed.push({ clause: 'STATEMENT', raw: statement.text.trim() })
    }
  }

  // One statement the parser will not take is a warning: the rest of the file
  // still draws, and `--strict` is there to refuse it. None of them parsing
  // and no table coming out is a different thing — the wrong file, or the
  // wrong --format — and that is worth stopping for rather than handing back
  // an empty diagram that looks like a schema with no tables in it.
  const first = unreadable[0]
  if (first !== undefined && Object.keys(schema.tables).length === 0) {
    errors.push(
      new UnexpectedTokenWarningError(
        `Nothing in this file could be read. First statement: ${first.split('\n')[0]}`,
      ),
    )
  }

  const validation = safeParse(schemaSchema, schema)

  if (!validation.success) {
    const validationErrors = validation.issues.map(
      (issue: InferIssue<typeof schemaSchema>) => {
        const path =
          issue.path && issue.path.length > 0
            ? issue.path.map((p) => p.key).join('.')
            : 'schema'
        return new UnexpectedTokenWarningError(
          `Schema validation failed at ${path}: ${issue.message}`,
        )
      },
    )

    return { value: schema, errors: errors.concat(validationErrors), unparsed }
  }

  return { value: validation.output, errors, unparsed }
}
