// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import type {
  Column,
  Constraint,
  ForeignKeyConstraint,
  Index,
  Schema,
  Table,
  Tables,
} from '@crowfoot/schema'
import { tableSchema } from '@crowfoot/schema'
import * as v from 'valibot'

/**
 * Edits the viewer made to the schema on top of the schema.json the build
 * shipped.
 *
 * Whole tables, not an operation log. A rename is "this key went away and that
 * one arrived", not a `RENAME` op — which means there is no op ordering to
 * replay, no way for two edits to conflict, and no migration to write when a
 * new field appears on `Table`. The cost is that touching one column re-encodes
 * that table; the URL still only carries the tables actually edited, the same
 * bargain `?positions=` makes by encoding only the tables actually moved.
 */
type SchemaEdits = {
  /** Tables inserted or replaced wholesale, keyed by table name. */
  tables: Tables
  /** Names dropped from the base schema. */
  removed: string[]
}

const EMPTY_SCHEMA_EDITS: SchemaEdits = { tables: {}, removed: [] }

const isEmptyEdits = (edits: SchemaEdits): boolean =>
  edits.removed.length === 0 && Object.keys(edits.tables).length === 0

/**
 * Records are always rebuilt with `Object.fromEntries`, never `record[key] =`.
 * A table named `__proto__` survives `JSON.parse` as a real own property, and
 * assigning it with `[[Set]]` would hit the prototype setter instead — the same
 * trap `parseGroups` avoids by keying its duplicate check on a `Set`.
 */
const recordOf = <T>(
  entries: readonly (readonly [string, T])[],
): Record<string, T> => Object.fromEntries(entries)

/**
 * Own-key test that is safe on records parsed straight out of JSON, where
 * `record.hasOwnProperty` is whatever the payload said it was.
 *
 * `Object.hasOwn` is the obvious call and is what biome rewrites
 * `Object.prototype.hasOwnProperty.call` into — but it is ES2022, and the CLI
 * compiles these sources under an ES2020 lib, so neither is available here.
 * The records this runs on hold tables, columns and constraints; the linear
 * scan is not worth a second thought.
 */
export const hasOwn = (record: object, key: string): boolean =>
  Object.keys(record).includes(key)

/**
 * Total — never throws, mirroring `parseGroups`. A malformed `?schemaedits=`
 * must degrade to "no edits", never take the whole ERD down with it.
 */
export const parseSchemaEdits = (value: unknown): SchemaEdits => {
  if (typeof value !== 'object' || value === null) return EMPTY_SCHEMA_EDITS

  const rawTables =
    'tables' in value && typeof value.tables === 'object' && value.tables
      ? value.tables
      : {}

  const tables = Object.entries(rawTables).flatMap(([name, table]) => {
    const result = v.safeParse(tableSchema, table)
    // The key is authoritative: a payload whose `name` disagrees with the key
    // it is filed under would apply to one table and render as another.
    if (!result.success || result.output.name !== name) return []
    return [[name, result.output] as const]
  })

  const removed =
    'removed' in value && Array.isArray(value.removed)
      ? value.removed.filter((name): name is string => typeof name === 'string')
      : []

  return { tables: recordOf(tables), removed }
}

export const serializeSchemaEdits = (edits: SchemaEdits): string =>
  isEmptyEdits(edits) ? '' : JSON.stringify(edits)

export const deserializeSchemaEdits = (raw: string): SchemaEdits | null => {
  if (raw === '') return null

  try {
    return parseSchemaEdits(JSON.parse(raw))
  } catch {
    return null
  }
}

/**
 * Base schema + edits. Base order is preserved so an edited table keeps its
 * place in every list; tables the viewer added are appended.
 */
export const applySchemaEdits = (
  schema: Schema,
  edits: SchemaEdits | null,
): Schema => {
  if (!edits || isEmptyEdits(edits)) return schema

  const removed = new Set(edits.removed)

  const existing = Object.entries(schema.tables)
    .filter(([name]) => !removed.has(name))
    .map(([name, table]) => [name, edits.tables[name] ?? table] as const)

  const added = Object.entries(edits.tables).filter(
    ([name]) => !hasOwn(schema.tables, name) && !removed.has(name),
  )

  return { ...schema, tables: recordOf([...existing, ...added]) }
}

/**
 * The inverse: what has to be stored so `applySchemaEdits(base, …)` reproduces
 * `next`. Called on every commit, so the URL never accumulates entries for
 * tables that were edited back to their original shape.
 *
 * ponytail: structural comparison is `JSON.stringify`, which is order-
 * sensitive. Both sides are built by spreading the original, so key order
 * holds; the worst a false "changed" can do is put one redundant table in the
 * URL, never lose or corrupt an edit.
 */
export const diffSchemaEdits = (base: Schema, next: Schema): SchemaEdits => {
  const tables = Object.entries(next.tables).filter(([name, table]) => {
    const original = hasOwn(base.tables, name) ? base.tables[name] : undefined
    return !original || JSON.stringify(original) !== JSON.stringify(table)
  })

  const removed = Object.keys(base.tables).filter(
    (name) => !hasOwn(next.tables, name),
  )

  return { tables: recordOf(tables), removed }
}

// --- Structural edits -------------------------------------------------------
//
// Everything a form can express — a column's type, an index's uniqueness, a
// constraint's columns — is "build the new Table and hand it over", so `putTable`
// covers it. What lives here instead are the edits that reach *outside* the
// table being edited: renames and deletions, whose references other tables hold.

const withTables = (schema: Schema, tables: Tables): Schema => ({
  ...schema,
  tables,
})

const isForeignKey = (
  constraint: Constraint,
): constraint is ForeignKeyConstraint => constraint.type === 'FOREIGN KEY'

/** Column-name pairs of a composite FK, so both sides stay aligned. */
const fkPairs = (fk: ForeignKeyConstraint): [string, string][] =>
  fk.columnNames.flatMap<[string, string]>((columnName, index) => {
    const target = fk.targetColumnNames[index]
    return target === undefined ? [] : [[columnName, target]]
  })

const fkFromPairs = (
  fk: ForeignKeyConstraint,
  pairs: [string, string][],
): ForeignKeyConstraint => ({
  ...fk,
  columnNames: pairs.map(([source]) => source),
  targetColumnNames: pairs.map(([, target]) => target),
})

/**
 * Rewrites one table's constraints, dropping any the mapper empties. A
 * PRIMARY KEY left with no columns is not a table without a primary key, it is
 * a malformed constraint the deparsers would emit as `PRIMARY KEY ()`.
 */
const mapConstraints = (
  table: Table,
  map: (constraint: Constraint) => Constraint | null,
): Table => ({
  ...table,
  constraints: recordOf(
    Object.entries(table.constraints).flatMap(([key, constraint]) => {
      const next = map(constraint)
      return next === null ? [] : [[key, next] as const]
    }),
  ),
})

const mapIndexes = (
  table: Table,
  map: (index: Index) => Index | null,
): Table => ({
  ...table,
  indexes: recordOf(
    Object.entries(table.indexes).flatMap(([key, index]) => {
      const next = map(index)
      return next === null ? [] : [[key, next] as const]
    }),
  ),
})

/** Insert or replace by `table.name`. New tables are appended. */
export const putTable = (schema: Schema, table: Table): Schema => {
  if (!hasOwn(schema.tables, table.name)) {
    return withTables(schema, {
      ...schema.tables,
      [table.name]: table,
    })
  }

  return withTables(
    schema,
    recordOf(
      Object.entries(schema.tables).map(([name, existing]) =>
        name === table.name ? [name, table] : [name, existing],
      ),
    ),
  )
}

/**
 * `null` when the name is unusable — empty, or already taken by another table.
 * Callers surface that to the user; silently keeping the old name would look
 * like the rename worked until the next reload.
 */
export const renameTable = (
  schema: Schema,
  from: string,
  to: string,
): Schema | null => {
  if (to === '' || !hasOwn(schema.tables, from)) return null
  if (to !== from && hasOwn(schema.tables, to)) return null
  if (to === from) return schema

  const renamed = Object.entries(schema.tables).map(([name, table]) => {
    const key = name === from ? to : name
    const withName = name === from ? { ...table, name: to } : table

    // Every FK anywhere in the schema that pointed at the old name follows it.
    // Without this the relationship edge silently disappears the moment a table
    // is renamed, which reads as "the rename deleted my foreign keys".
    return [
      key,
      mapConstraints(withName, (constraint) =>
        isForeignKey(constraint) && constraint.targetTableName === from
          ? { ...constraint, targetTableName: to }
          : constraint,
      ),
    ] as const
  })

  return withTables(schema, recordOf(renamed))
}

/** Drops the table, and every FK in the surviving tables that pointed at it. */
export const dropTable = (schema: Schema, name: string): Schema => {
  const remaining = Object.entries(schema.tables)
    .filter(([tableName]) => tableName !== name)
    .map(
      ([tableName, table]) =>
        [
          tableName,
          mapConstraints(table, (constraint) =>
            isForeignKey(constraint) && constraint.targetTableName === name
              ? null
              : constraint,
          ),
        ] as const,
    )

  return withTables(schema, recordOf(remaining))
}

/**
 * Renames a column and follows every reference to it: this table's constraints
 * and indexes, plus the `targetColumnNames` of foreign keys in other tables.
 *
 * CHECK constraints are deliberately left alone — `detail` is free-form SQL,
 * and a search-and-replace inside it would corrupt any expression where the
 * column name also appears as a string literal or a substring of another
 * identifier.
 */
export const renameColumn = (
  schema: Schema,
  tableName: string,
  from: string,
  to: string,
): Schema | null => {
  const table = hasOwn(schema.tables, tableName)
    ? schema.tables[tableName]
    : undefined
  if (!table || to === '' || !hasOwn(table.columns, from)) return null
  if (to !== from && hasOwn(table.columns, to)) return null
  if (to === from) return schema

  const swap = (name: string) => (name === from ? to : name)

  const renamedTable = mapIndexes(
    mapConstraints(
      {
        ...table,
        columns: recordOf(
          Object.entries(table.columns).map(([name, column]) =>
            name === from
              ? ([to, { ...column, name: to }] as const)
              : ([name, column] as const),
          ),
        ),
      },
      (constraint) =>
        constraint.type === 'CHECK'
          ? constraint
          : { ...constraint, columnNames: constraint.columnNames.map(swap) },
    ),
    (index) => ({ ...index, columns: index.columns.map(swap) }),
  )

  const tables = Object.entries(schema.tables).map(([name, other]) => {
    if (name === tableName) return [name, renamedTable] as const

    return [
      name,
      mapConstraints(other, (constraint) =>
        isForeignKey(constraint) && constraint.targetTableName === tableName
          ? {
              ...constraint,
              targetColumnNames: constraint.targetColumnNames.map(swap),
            }
          : constraint,
      ),
    ] as const
  })

  return withTables(schema, recordOf(tables))
}

/**
 * Drops a column together with every reference to it. Constraints and indexes
 * left with no columns are dropped rather than kept empty, and a composite
 * foreign key loses the *pair* the column belonged to so its two column lists
 * stay the same length.
 */
export const dropColumn = (
  schema: Schema,
  tableName: string,
  columnName: string,
): Schema => {
  const table = hasOwn(schema.tables, tableName)
    ? schema.tables[tableName]
    : undefined
  if (!table) return schema

  const strippedTable = mapIndexes(
    mapConstraints(
      {
        ...table,
        columns: recordOf(
          Object.entries(table.columns).filter(([name]) => name !== columnName),
        ),
      },
      (constraint) => {
        if (constraint.type === 'CHECK') return constraint

        if (isForeignKey(constraint)) {
          const pairs = fkPairs(constraint).filter(
            ([source]) => source !== columnName,
          )
          return pairs.length === 0 ? null : fkFromPairs(constraint, pairs)
        }

        const columnNames = constraint.columnNames.filter(
          (name) => name !== columnName,
        )
        return columnNames.length === 0 ? null : { ...constraint, columnNames }
      },
    ),
    (index) => {
      const columns = index.columns.filter((name) => name !== columnName)
      return columns.length === 0 ? null : { ...index, columns }
    },
  )

  const tables = Object.entries(schema.tables).map(([name, other]) => {
    if (name === tableName) return [name, strippedTable] as const

    return [
      name,
      mapConstraints(other, (constraint) => {
        if (!isForeignKey(constraint)) return constraint
        if (constraint.targetTableName !== tableName) return constraint

        const pairs = fkPairs(constraint).filter(
          ([, target]) => target !== columnName,
        )
        return pairs.length === 0 ? null : fkFromPairs(constraint, pairs)
      }),
    ] as const
  })

  return withTables(schema, recordOf(tables))
}

// --- Constructors -----------------------------------------------------------

export const createColumn = (name: string, type = 'text'): Column => ({
  name,
  type,
  default: null,
  check: null,
  notNull: false,
  comment: null,
})

export const createTable = (name: string): Table => ({
  name,
  columns: {},
  comment: null,
  indexes: {},
  constraints: {},
})

/** `name`, `name_2`, `name_3`… — the first that is not already taken. */
export const uniqueName = (taken: Iterable<string>, name: string): string => {
  const used = new Set(taken)
  if (!used.has(name)) return name

  let suffix = 2
  while (used.has(`${name}_${suffix}`)) suffix += 1
  return `${name}_${suffix}`
}

const primaryKeyOf = (table: Table): string[] => {
  const pk = Object.values(table.constraints).find(
    (constraint) => constraint.type === 'PRIMARY KEY',
  )
  return pk?.type === 'PRIMARY KEY' ? pk.columnNames : []
}

/**
 * The column a new foreign key should hang off, by convention: `orders_id`,
 * then the singular `order_id`, then nothing — in which case the caller
 * creates it. Deliberately two guesses and no inflector; anything cleverer
 * would be wrong in a way the viewer cannot see, and the drawer can retarget
 * the key in two clicks.
 */
const referencingColumn = (
  source: Table,
  targetName: string,
  targetColumn: string,
): string | null => {
  const candidates = [
    `${targetName}_${targetColumn}`,
    ...(targetName.endsWith('s')
      ? [`${targetName.slice(0, -1)}_${targetColumn}`]
      : []),
  ]

  return candidates.find((name) => hasOwn(source.columns, name)) ?? null
}

type ConnectResult = {
  schema: Schema
  /** Columns that had to be created because nothing suitable existed. */
  createdColumns: string[]
  constraintName: string
}

/**
 * Draws a relationship between two tables: the canvas right-click gesture.
 *
 * `null` when the target has no primary key — there is nothing to reference,
 * and inventing one would silently rewrite a table the viewer did not ask to
 * touch.
 */
export const connectTables = (
  schema: Schema,
  sourceName: string,
  targetName: string,
): ConnectResult | null => {
  const source = hasOwn(schema.tables, sourceName)
    ? schema.tables[sourceName]
    : undefined
  const target = hasOwn(schema.tables, targetName)
    ? schema.tables[targetName]
    : undefined
  if (!source || !target) return null

  const targetColumns = primaryKeyOf(target)
  if (targetColumns.length === 0) return null

  const createdColumns: string[] = []
  let columns = source.columns

  const columnNames = targetColumns.map((targetColumn) => {
    const existing = referencingColumn(source, targetName, targetColumn)
    if (existing) return existing

    const name = uniqueName(
      Object.keys(columns),
      `${targetName}_${targetColumn}`,
    )
    const type = target.columns[targetColumn]?.type ?? 'text'
    columns = { ...columns, [name]: createColumn(name, type) }
    createdColumns.push(name)
    return name
  })

  const constraintName = uniqueName(
    Object.keys(source.constraints),
    `fk_${sourceName}_${targetName}`,
  )

  const constraint: ForeignKeyConstraint = {
    type: 'FOREIGN KEY',
    name: constraintName,
    columnNames,
    targetTableName: targetName,
    targetColumnNames: targetColumns,
    updateConstraint: 'NO_ACTION',
    deleteConstraint: 'NO_ACTION',
  }

  return {
    schema: putTable(schema, {
      ...source,
      columns,
      constraints: { ...source.constraints, [constraintName]: constraint },
    }),
    createdColumns,
    constraintName,
  }
}
