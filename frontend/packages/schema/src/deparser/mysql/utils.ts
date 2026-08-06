// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import type { Column, Constraint, Index, Table } from '../../schema/index.js'

/**
 * MySQL quotes identifiers with backticks; an embedded backtick is doubled.
 */
function escapeIdentifier(identifier: string): string {
  return `\`${identifier.replace(/`/g, '``')}\``
}

/**
 * MySQL treats backslash as an escape character by default, so it has to be
 * doubled as well as the quote.
 */
function escapeString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "''")
}

/** Bare words MySQL accepts as a DEFAULT without quoting. */
const KEYWORD_DEFAULTS = new Set([
  'CURRENT_TIMESTAMP',
  'CURRENT_DATE',
  'CURRENT_TIME',
  'NULL',
  'TRUE',
  'FALSE',
])

const FUNCTION_CALL = /^[a-z_][a-z0-9_]*\s*\(.*\)$/i

/**
 * Renders a column default. Returns null when there is none.
 * Getting this wrong is the classic way to produce DDL that looks fine and
 * then inserts the literal string "CURRENT_TIMESTAMP" into a datetime column.
 */
function formatDefault(value: string | number | boolean | null): string | null {
  if (value === null) return null
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'

  const trimmed = value.trim()
  if (KEYWORD_DEFAULTS.has(trimmed.toUpperCase())) return trimmed.toUpperCase()
  if (FUNCTION_CALL.test(trimmed)) return trimmed

  return `'${escapeString(value)}'`
}

function generateColumnDefinition(column: Column): string {
  const parts = [escapeIdentifier(column.name), column.type]

  if (column.notNull) parts.push('NOT NULL')

  const defaultValue = formatDefault(column.default)
  if (defaultValue !== null) parts.push(`DEFAULT ${defaultValue}`)

  if (column.check) parts.push(`CHECK (${column.check})`)
  if (column.comment) parts.push(`COMMENT '${escapeString(column.comment)}'`)

  return parts.join(' ')
}

const isPrimaryKey = (constraint: Constraint) =>
  constraint.type === 'PRIMARY KEY'

/**
 * MySQL has no `COMMENT ON`; comments are inline, and the primary key is
 * declared inside CREATE TABLE rather than added afterwards.
 */
export function generateCreateTableStatement(table: Table): string {
  const definitions = Object.values(table.columns).map(generateColumnDefinition)

  const primaryKey = Object.values(table.constraints).find(isPrimaryKey)
  if (primaryKey) {
    const columns = primaryKey.columnNames.map(escapeIdentifier).join(', ')
    definitions.push(`PRIMARY KEY (${columns})`)
  }

  const tableComment = table.comment
    ? ` COMMENT='${escapeString(table.comment)}'`
    : ''

  return `CREATE TABLE ${escapeIdentifier(table.name)} (\n  ${definitions.join(
    ',\n  ',
  )}\n)${tableComment};`
}

export function generateCreateIndexStatement(
  tableName: string,
  index: Index,
): string {
  const unique = index.unique ? 'UNIQUE ' : ''
  const columns = index.columns.map(escapeIdentifier).join(', ')

  return `CREATE ${unique}INDEX ${escapeIdentifier(
    index.name,
  )} ON ${escapeIdentifier(tableName)} (${columns});`
}

/** The schema stores reference options with underscores (`SET_NULL`). */
const referenceOption = (option: string): string => option.replace(/_/g, ' ')

export function generateAddConstraintStatement(
  tableName: string,
  constraint: Constraint,
): string | null {
  const table = escapeIdentifier(tableName)
  const name = escapeIdentifier(constraint.name)

  switch (constraint.type) {
    // Already emitted inside CREATE TABLE.
    case 'PRIMARY KEY':
      return null

    case 'UNIQUE': {
      const columns = constraint.columnNames.map(escapeIdentifier).join(', ')
      return `ALTER TABLE ${table} ADD CONSTRAINT ${name} UNIQUE (${columns});`
    }

    case 'CHECK':
      return `ALTER TABLE ${table} ADD CONSTRAINT ${name} CHECK (${constraint.detail});`

    case 'FOREIGN KEY': {
      const columns = constraint.columnNames.map(escapeIdentifier).join(', ')
      const targetColumns = constraint.targetColumnNames
        .map(escapeIdentifier)
        .join(', ')

      // NO ACTION is InnoDB's default; emitting it on every key is noise.
      const onUpdate =
        constraint.updateConstraint === 'NO_ACTION'
          ? ''
          : ` ON UPDATE ${referenceOption(constraint.updateConstraint)}`
      const onDelete =
        constraint.deleteConstraint === 'NO_ACTION'
          ? ''
          : ` ON DELETE ${referenceOption(constraint.deleteConstraint)}`

      return `ALTER TABLE ${table} ADD CONSTRAINT ${name} FOREIGN KEY (${columns}) REFERENCES ${escapeIdentifier(
        constraint.targetTableName,
      )} (${targetColumns})${onDelete}${onUpdate};`
    }

    default:
      return null
  }
}
