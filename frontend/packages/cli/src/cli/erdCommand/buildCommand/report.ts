// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import type { Constraint, Schema } from '@crowfoot/schema/schema'

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
export const buildReport = (schema: Schema): BuildReport => {
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
  }
}
