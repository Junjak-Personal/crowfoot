// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import type { Unparsed } from '@crowfoot/schema/parser'
import type { Constraint, Schema } from '@crowfoot/schema/schema'
import { yellow } from 'yoctocolors'
import { type CliError, CriticalError } from '../../errors.js'

type BuildReport = {
  tables: number
  columns: number
  constraints: {
    primaryKey: number
    foreignKey: number
    unique: number
    check: number
  }
  indexes: number
  enums: number
  extensions: number
  /** Read but not representable — see `Unparsed`. Empty is the good answer. */
  unparsed: Unparsed[]
}

/**
 * What the build read, counted off the schema it just wrote.
 *
 * Derived rather than tallied during parsing, so the numbers describe
 * `schema.json` itself — the file every consumer downstream actually reads. A
 * tally kept by the parser could disagree with what landed on disk, and there
 * would be no way to tell which of the two was lying.
 *
 * `enums` and `extensions` are here because they are the rest of what a schema
 * carries. A parser that silently read none of either leaves every table count
 * correct, which is the one failure a count is otherwise blind to.
 */
export const buildReport = (
  schema: Schema,
  unparsed: Unparsed[],
): BuildReport => {
  const tables = Object.values(schema.tables)
  const constraints = tables.flatMap((table) =>
    Object.values(table.constraints),
  )

  const countOf = (type: Constraint['type']) =>
    constraints.filter((constraint) => constraint.type === type).length

  const sumOf = (pick: (table: (typeof tables)[number]) => object) =>
    tables.reduce((total, table) => total + Object.keys(pick(table)).length, 0)

  return {
    tables: tables.length,
    columns: sumOf((table) => table.columns),
    constraints: {
      primaryKey: countOf('PRIMARY KEY'),
      foreignKey: countOf('FOREIGN KEY'),
      unique: countOf('UNIQUE'),
      check: countOf('CHECK'),
    },
    indexes: sumOf((table) => table.indexes),
    enums: Object.keys(schema.enums).length,
    extensions: Object.keys(schema.extensions).length,
    unparsed,
  }
}

type OutcomeParams = {
  schema: Schema
  unparsed: Unparsed[]
  json: boolean
  strict: boolean
}

/**
 * Says what the build read, and turns a loss into a failure under `--strict`.
 *
 * The report goes to stdout and everything else to stderr, so
 * `erd build --json > report.json` stays a file rather than a transcript. The
 * warning is printed with or without `--json`: a loss nobody was told about is
 * the thing this exists to stop, and someone who did not ask for a report
 * still gets the one line that says to go looking.
 */
export const reportOutcome = ({
  schema,
  unparsed,
  json,
  strict,
}: OutcomeParams): CliError[] => {
  if (json) {
    process.stdout.write(
      `${JSON.stringify(buildReport(schema, unparsed), null, 2)}\n`,
    )
  }

  if (unparsed.length === 0) return []

  const first = unparsed[0]
  const summary = `${unparsed.length} clause(s) read but not represented`

  console.error(yellow(`WARN: ${summary}. Run with --json to see them.`))

  if (!strict || first === undefined) return []

  return [
    new CriticalError(
      `${summary}, and --strict was given. ` +
        `First: ${first.table}.${first.column} ${first.clause} ${first.raw}`,
    ),
  ]
}
