// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import type { Schema, Table } from '@crowfoot/schema'
import { describe, expect, it } from 'vitest'
import {
  applySchemaEdits,
  connectTables,
  createColumn,
  createTable,
  deserializeSchemaEdits,
  diffSchemaEdits,
  dropColumn,
  dropTable,
  parseSchemaEdits,
  putTable,
  renameColumn,
  renameTable,
  serializeSchemaEdits,
} from './schemaEdit'

const table = (name: string, overrides: Partial<Table> = {}): Table => ({
  ...createTable(name),
  ...overrides,
})

/**
 * `users(id, name)` ← `orders(id, users_id)`, so every cascade has both a
 * within-table reference (the PK, the index) and a cross-table one (the FK).
 */
const baseSchema = (): Schema => ({
  tables: {
    users: table('users', {
      columns: {
        id: createColumn('id', 'bigint'),
        name: createColumn('name'),
      },
      constraints: {
        users_pkey: {
          type: 'PRIMARY KEY',
          name: 'users_pkey',
          columnNames: ['id'],
        },
      },
      indexes: {
        users_name_idx: {
          name: 'users_name_idx',
          unique: false,
          columns: ['name'],
          type: 'btree',
        },
      },
    }),
    orders: table('orders', {
      columns: {
        id: createColumn('id', 'bigint'),
        users_id: createColumn('users_id', 'bigint'),
      },
      constraints: {
        orders_pkey: {
          type: 'PRIMARY KEY',
          name: 'orders_pkey',
          columnNames: ['id'],
        },
        fk_orders_users: {
          type: 'FOREIGN KEY',
          name: 'fk_orders_users',
          columnNames: ['users_id'],
          targetTableName: 'users',
          targetColumnNames: ['id'],
          updateConstraint: 'NO_ACTION',
          deleteConstraint: 'NO_ACTION',
        },
      },
    }),
  },
  enums: {},
  extensions: {},
})

describe('applySchemaEdits', () => {
  it('returns the base schema untouched when there are no edits', () => {
    const schema = baseSchema()
    expect(applySchemaEdits(schema, null)).toBe(schema)
    expect(applySchemaEdits(schema, { tables: {}, removed: [] })).toBe(schema)
  })

  it('keeps base ordering for edited tables and appends new ones', () => {
    const edited = applySchemaEdits(baseSchema(), {
      tables: {
        users: table('users', { comment: 'edited' }),
        audits: table('audits'),
      },
      removed: [],
    })

    expect(Object.keys(edited.tables)).toEqual(['users', 'orders', 'audits'])
    expect(edited.tables['users']?.comment).toBe('edited')
  })

  it('drops removed tables even when an edit still names them', () => {
    const edited = applySchemaEdits(baseSchema(), {
      tables: { users: table('users', { comment: 'stale' }) },
      removed: ['users'],
    })

    expect(Object.keys(edited.tables)).toEqual(['orders'])
  })
})

describe('diffSchemaEdits', () => {
  it('records nothing when the schema is structurally unchanged', () => {
    expect(diffSchemaEdits(baseSchema(), baseSchema())).toEqual({
      tables: {},
      removed: [],
    })
  })

  it('round-trips through apply', () => {
    const base = baseSchema()
    const next = putTable(base, table('users', { comment: 'hello' }))
    const edits = diffSchemaEdits(base, next)

    expect(Object.keys(edits.tables)).toEqual(['users'])
    expect(applySchemaEdits(base, edits)).toEqual(next)
  })

  it('records a deletion', () => {
    const base = baseSchema()
    const edits = diffSchemaEdits(base, dropTable(base, 'orders'))

    expect(edits.removed).toEqual(['orders'])
    expect(applySchemaEdits(base, edits).tables['orders']).toBeUndefined()
  })
})

describe('renameTable', () => {
  it('retargets foreign keys that pointed at the old name', () => {
    const renamed = renameTable(baseSchema(), 'users', 'accounts')

    expect(Object.keys(renamed?.tables ?? {})).toEqual(['accounts', 'orders'])
    expect(renamed?.tables['accounts']?.name).toBe('accounts')
    expect(
      renamed?.tables['orders']?.constraints['fk_orders_users'],
    ).toMatchObject({ targetTableName: 'accounts' })
  })

  it('refuses an empty or already-taken name', () => {
    expect(renameTable(baseSchema(), 'users', '')).toBeNull()
    expect(renameTable(baseSchema(), 'users', 'orders')).toBeNull()
  })
})

describe('dropTable', () => {
  it('drops foreign keys in other tables that referenced it', () => {
    const dropped = dropTable(baseSchema(), 'users')

    expect(Object.keys(dropped.tables)).toEqual(['orders'])
    expect(Object.keys(dropped.tables['orders']?.constraints ?? {})).toEqual([
      'orders_pkey',
    ])
  })
})

describe('renameColumn', () => {
  it('follows constraints, indexes and foreign keys pointing at it', () => {
    const renamed = renameColumn(baseSchema(), 'users', 'id', 'user_id')

    expect(Object.keys(renamed?.tables['users']?.columns ?? {})).toEqual([
      'user_id',
      'name',
    ])
    expect(renamed?.tables['users']?.constraints['users_pkey']).toMatchObject({
      columnNames: ['user_id'],
    })
    expect(
      renamed?.tables['orders']?.constraints['fk_orders_users'],
    ).toMatchObject({ targetColumnNames: ['user_id'] })
  })

  it('leaves CHECK details alone', () => {
    const schema = putTable(
      baseSchema(),
      table('users', {
        columns: { id: createColumn('id') },
        constraints: {
          users_id_positive: {
            type: 'CHECK',
            name: 'users_id_positive',
            detail: 'id > 0',
          },
        },
      }),
    )

    const renamed = renameColumn(schema, 'users', 'id', 'user_id')

    expect(renamed?.tables['users']?.constraints['users_id_positive']).toEqual({
      type: 'CHECK',
      name: 'users_id_positive',
      detail: 'id > 0',
    })
  })

  it('refuses a name another column already has', () => {
    expect(renameColumn(baseSchema(), 'users', 'id', 'name')).toBeNull()
  })
})

describe('dropColumn', () => {
  it('drops the constraints and indexes it emptied', () => {
    const dropped = dropColumn(baseSchema(), 'users', 'name')

    expect(dropped.tables['users']?.indexes).toEqual({})
  })

  it('drops foreign keys in other tables that targeted it', () => {
    const dropped = dropColumn(baseSchema(), 'users', 'id')

    expect(dropped.tables['users']?.constraints).toEqual({})
    expect(Object.keys(dropped.tables['orders']?.constraints ?? {})).toEqual([
      'orders_pkey',
    ])
  })

  it('removes the whole pair from a composite foreign key', () => {
    const schema = putTable(
      baseSchema(),
      table('orders', {
        columns: {
          a: createColumn('a'),
          b: createColumn('b'),
        },
        constraints: {
          fk: {
            type: 'FOREIGN KEY',
            name: 'fk',
            columnNames: ['a', 'b'],
            targetTableName: 'users',
            targetColumnNames: ['id', 'name'],
            updateConstraint: 'NO_ACTION',
            deleteConstraint: 'NO_ACTION',
          },
        },
      }),
    )

    expect(
      dropColumn(schema, 'orders', 'a').tables['orders']?.constraints['fk'],
    ).toMatchObject({ columnNames: ['b'], targetColumnNames: ['name'] })
  })
})

describe('connectTables', () => {
  it('reuses a column that already follows the naming convention', () => {
    const result = connectTables(baseSchema(), 'orders', 'users')

    expect(result?.createdColumns).toEqual([])
    expect(
      result?.schema.tables['orders']?.constraints[result.constraintName],
    ).toMatchObject({
      columnNames: ['users_id'],
      targetTableName: 'users',
      targetColumnNames: ['id'],
    })
  })

  it('creates the referencing column when none exists, copying the key type', () => {
    const schema = putTable(baseSchema(), table('orders'))
    const result = connectTables(schema, 'orders', 'users')

    expect(result?.createdColumns).toEqual(['users_id'])
    expect(result?.schema.tables['orders']?.columns['users_id']?.type).toBe(
      'bigint',
    )
  })

  it('refuses a target with no primary key', () => {
    const schema = putTable(
      baseSchema(),
      table('users', { columns: { id: createColumn('id') } }),
    )

    expect(connectTables(schema, 'orders', 'users')).toBeNull()
  })
})

describe('parseSchemaEdits', () => {
  it('survives a payload that is not edits at all', () => {
    expect(parseSchemaEdits(null)).toEqual({ tables: {}, removed: [] })
    expect(parseSchemaEdits('nonsense')).toEqual({ tables: {}, removed: [] })
    expect(parseSchemaEdits({ tables: 7, removed: 'no' })).toEqual({
      tables: {},
      removed: [],
    })
  })

  it('skips entries whose name disagrees with their key', () => {
    expect(
      parseSchemaEdits({ tables: { users: table('accounts') }, removed: [] })
        .tables,
    ).toEqual({})
  })

  it('skips malformed tables without losing the sound ones', () => {
    const parsed = parseSchemaEdits({
      tables: { users: table('users'), broken: { name: 'broken' } },
      removed: ['gone'],
    })

    expect(Object.keys(parsed.tables)).toEqual(['users'])
    expect(parsed.removed).toEqual(['gone'])
  })

  it('round-trips through serialize/deserialize', () => {
    const base = baseSchema()
    const edits = diffSchemaEdits(base, dropTable(base, 'orders'))

    expect(deserializeSchemaEdits(serializeSchemaEdits(edits))).toEqual(edits)
  })

  it('serializes empty edits to the absent-parameter form', () => {
    expect(serializeSchemaEdits({ tables: {}, removed: [] })).toBe('')
    expect(deserializeSchemaEdits('')).toBeNull()
    expect(deserializeSchemaEdits('{oops')).toBeNull()
  })
})
