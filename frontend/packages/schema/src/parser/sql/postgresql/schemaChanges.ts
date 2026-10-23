// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import type { Constraint, Schema, Table } from '../../../schema/index.js'

/**
 * The statements a migration uses to change a schema it already created,
 * applied to the schema being built rather than executed against a database.
 *
 * A column name is written down in more places than the column: the key it is
 * filed under, its own `name`, the `columnNames` of every key and unique
 * constraint over it, the `columns` of every index on it, and the
 * `targetColumnNames` of every foreign key in *another* table pointing at it.
 * Renaming one and missing any of those leaves a constraint naming a column
 * that is not there — which draws, and draws wrong. Each function here is
 * responsible for the whole set.
 *
 * A CHECK constraint's `detail` is free text, and a rename leaves it alone:
 * rewriting an identifier inside an arbitrary expression means parsing the
 * expression, and being wrong there would corrupt the condition rather than
 * lose it. A drop is the other way round — nothing is rewritten, the whole
 * constraint goes, which is what postgres does with it — so there a CHECK
 * naming the column has to be found. See `mentionsColumn`.
 */

/**
 * Refile an entry under a new key, keeping every entry in its place and the
 * record itself the same object — the converter holds references to these, and
 * replacing one would leave it writing into a record nothing reads.
 */
const renameKey = <T>(
  record: Record<string, T>,
  from: string,
  to: string,
): void => {
  const entries = Object.entries(record).map(
    ([key, value]) => [key === from ? to : key, value] as const,
  )

  for (const key of Object.keys(record)) delete record[key]
  for (const [key, value] of entries) record[key] = value
}

const swap = (names: string[], from: string, to: string): string[] =>
  names.map((name) => (name === from ? to : name))

/** Every constraint that lists columns, as opposed to CHECK's free text. */
const hasColumnNames = (
  constraint: Constraint,
): constraint is Extract<Constraint, { columnNames: string[] }> =>
  constraint.type !== 'CHECK'

/** What can appear inside a name, and therefore what does not end one. */
const IDENTIFIER_CHAR = /[A-Za-z0-9_$]/

/** The index just past the single-quoted literal starting at `i`. */
const endOfLiteral = (detail: string, i: number): number => {
  for (let j = i + 1; j < detail.length; j++) {
    if (detail[j] !== "'") continue
    // '' is an escaped quote, not the end.
    if (detail[j + 1] === "'") j++
    else return j + 1
  }

  return detail.length
}

/**
 * Whether a CHECK's expression names this column.
 *
 * Read as text, because text is what the expression is: postgres tracks the
 * real dependency and what reaches here is the condition as written. Two
 * things keep that honest. A match has to stand alone as a name, so dropping
 * `priority` leaves a CHECK over `priority_filter` where it is; and quoted
 * literals are skipped, so `state <> 'priority'` is not a use of the column.
 */
const mentionsColumn = (detail: string, column: string): boolean => {
  const haystack = detail.toLowerCase()
  const needle = column.toLowerCase()

  for (let i = 0; i < haystack.length; i++) {
    if (haystack[i] === "'") {
      i = endOfLiteral(haystack, i) - 1
      continue
    }

    if (!haystack.startsWith(needle, i)) continue
    if (IDENTIFIER_CHAR.test(haystack[i - 1] ?? '')) continue
    if (IDENTIFIER_CHAR.test(haystack[i + needle.length] ?? '')) continue

    return true
  }

  return false
}

/** What postgres would drop along with the column. */
const dependsOnColumn = (constraint: Constraint, column: string): boolean =>
  hasColumnNames(constraint)
    ? constraint.columnNames.includes(column)
    : mentionsColumn(constraint.detail, column)

const foreignKeysOf = (table: Table) =>
  Object.values(table.constraints).filter(
    (constraint) => constraint.type === 'FOREIGN KEY',
  )

export const renameTable = (
  schema: Schema,
  from: string,
  to: string,
): boolean => {
  const table = schema.tables[from]
  if (table === undefined) return false

  table.name = to
  renameKey(schema.tables, from, to)

  for (const other of Object.values(schema.tables)) {
    for (const fk of foreignKeysOf(other)) {
      if (fk.targetTableName === from) fk.targetTableName = to
    }
  }

  return true
}

/**
 * A foreign key whose target is gone would draw an edge to nothing. Postgres
 * removes them with `CASCADE` and refuses the drop without it, so either way
 * they are not there afterwards.
 */
export const dropTable = (schema: Schema, name: string): boolean => {
  if (schema.tables[name] === undefined) return false
  delete schema.tables[name]

  for (const table of Object.values(schema.tables)) {
    for (const fk of foreignKeysOf(table)) {
      if (fk.targetTableName === name) delete table.constraints[fk.name]
    }
  }

  return true
}

export const renameColumn = (
  schema: Schema,
  tableName: string,
  from: string,
  to: string,
): boolean => {
  const table = schema.tables[tableName]
  const column = table?.columns[from]
  if (table === undefined || column === undefined) return false

  column.name = to
  renameKey(table.columns, from, to)

  for (const constraint of Object.values(table.constraints)) {
    if (hasColumnNames(constraint)) {
      constraint.columnNames = swap(constraint.columnNames, from, to)
    }
  }

  for (const index of Object.values(table.indexes)) {
    index.columns = swap(index.columns, from, to)
  }

  for (const other of Object.values(schema.tables)) {
    for (const fk of foreignKeysOf(other)) {
      if (fk.targetTableName !== tableName) continue
      fk.targetColumnNames = swap(fk.targetColumnNames, from, to)
    }
  }

  return true
}

/**
 * Everything naming the column goes with it, whether or not it names anything
 * else. Postgres drops what depends on a column, and an index over two columns
 * depends on both — it does not quietly become an index over the one that is
 * left. Narrowing them instead leaves the diagram showing indexes and
 * constraints the database does not have.
 */
export const dropColumn = (
  schema: Schema,
  tableName: string,
  name: string,
): boolean => {
  const table = schema.tables[tableName]
  if (table?.columns[name] === undefined) return false

  delete table.columns[name]

  for (const constraint of Object.values(table.constraints)) {
    if (dependsOnColumn(constraint, name)) {
      delete table.constraints[constraint.name]
    }
  }

  for (const index of Object.values(table.indexes)) {
    if (index.columns.includes(name)) delete table.indexes[index.name]
  }

  for (const other of Object.values(schema.tables)) {
    for (const fk of foreignKeysOf(other)) {
      if (fk.targetTableName !== tableName) continue
      if (fk.targetColumnNames.includes(name)) delete other.constraints[fk.name]
    }
  }

  return true
}

export const dropConstraint = (
  schema: Schema,
  tableName: string,
  name: string,
): boolean => {
  const table = schema.tables[tableName]
  if (table?.constraints[name] === undefined) return false

  delete table.constraints[name]
  return true
}

export const renameConstraint = (
  schema: Schema,
  tableName: string,
  from: string,
  to: string,
): boolean => {
  const table = schema.tables[tableName]
  const constraint = table?.constraints[from]
  if (table === undefined || constraint === undefined) return false

  constraint.name = to
  renameKey(table.constraints, from, to)
  return true
}

/** An index is named globally; the model files it under the table it is on. */
const tableWithIndex = (schema: Schema, name: string): Table | undefined =>
  Object.values(schema.tables).find(
    (table) => table.indexes[name] !== undefined,
  )

export const dropIndex = (schema: Schema, name: string): boolean => {
  const table = tableWithIndex(schema, name)
  if (table === undefined) return false

  delete table.indexes[name]
  return true
}

export const renameIndex = (
  schema: Schema,
  from: string,
  to: string,
): boolean => {
  const table = tableWithIndex(schema, from)
  const index = table?.indexes[from]
  if (table === undefined || index === undefined) return false

  index.name = to
  renameKey(table.indexes, from, to)
  return true
}

/**
 * `ADD VALUE 'x' BEFORE|AFTER 'y'` places the value; without a neighbour it
 * goes on the end. An enum's order is part of what it means, so a value put in
 * the wrong place is a wrong schema rather than a missing one.
 */
export const addEnumValue = (
  schema: Schema,
  enumName: string,
  value: string,
  neighbour?: string | undefined,
  isAfter = false,
): boolean => {
  const target = schema.enums[enumName]
  if (target === undefined) return false
  if (target.values.includes(value)) return true

  const at = neighbour === undefined ? -1 : target.values.indexOf(neighbour)
  target.values.splice(
    at === -1 ? target.values.length : isAfter ? at + 1 : at,
    0,
    value,
  )

  return true
}

export const dropEnum = (schema: Schema, name: string): boolean => {
  if (schema.enums[name] === undefined) return false

  delete schema.enums[name]
  return true
}

export const dropExtension = (schema: Schema, name: string): boolean => {
  if (schema.extensions[name] === undefined) return false

  delete schema.extensions[name]
  return true
}
