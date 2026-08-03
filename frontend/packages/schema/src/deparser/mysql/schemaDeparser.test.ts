// Added in erdkit; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import { describe, expect, it } from 'vitest'
import type { Schema, Table } from '../../schema/index.js'
import { mysqlSchemaDeparser } from './schemaDeparser.js'

const table = (overrides: Partial<Table> & { name: string }): Table => ({
  columns: {},
  comment: null,
  indexes: {},
  constraints: {},
  ...overrides,
})

const schemaOf = (...tables: Table[]): Schema => ({
  tables: Object.fromEntries(tables.map((t) => [t.name, t])),
  enums: {},
  extensions: {},
})

const ddlOf = (schema: Schema) => mysqlSchemaDeparser(schema).value

describe(mysqlSchemaDeparser, () => {
  it('quotes identifiers with backticks', () => {
    const ddl = ddlOf(
      schemaOf(
        table({
          name: 'users',
          columns: {
            id: {
              name: 'id',
              type: 'int',
              default: null,
              check: null,
              notNull: true,
              comment: null,
            },
          },
        }),
      ),
    )

    expect(ddl).toContain('CREATE TABLE `users`')
    expect(ddl).toContain('`id` int NOT NULL')
    // Double quotes are PostgreSQL's quoting, not MySQL's.
    expect(ddl).not.toContain('"users"')
  })

  it('declares the primary key inside CREATE TABLE', () => {
    const ddl = ddlOf(
      schemaOf(
        table({
          name: 'users',
          columns: {
            id: {
              name: 'id',
              type: 'int',
              default: null,
              check: null,
              notNull: true,
              comment: null,
            },
          },
          constraints: {
            PRIMARY: {
              type: 'PRIMARY KEY',
              name: 'PRIMARY',
              columnNames: ['id'],
            },
          },
        }),
      ),
    )

    expect(ddl).toContain('PRIMARY KEY (`id`)')
    expect(ddl).not.toContain('ADD CONSTRAINT `PRIMARY`')
  })

  it('does not emit an index that a constraint already creates', () => {
    const ddl = ddlOf(
      schemaOf(
        table({
          name: 'block_codes',
          indexes: {
            PRIMARY: {
              name: 'PRIMARY',
              unique: true,
              columns: ['id'],
              type: 'btree',
            },
            uq_block_code: {
              name: 'uq_block_code',
              unique: true,
              columns: ['code'],
              type: 'btree',
            },
            idx_plain: {
              name: 'idx_plain',
              unique: false,
              columns: ['code'],
              type: 'btree',
            },
          },
          constraints: {
            PRIMARY: {
              type: 'PRIMARY KEY',
              name: 'PRIMARY',
              columnNames: ['id'],
            },
            uq_block_code: {
              type: 'UNIQUE',
              name: 'uq_block_code',
              columnNames: ['code'],
            },
          },
        }),
      ),
    )

    // Emitting both would fail with "Duplicate key name".
    expect(ddl).not.toContain('CREATE UNIQUE INDEX `uq_block_code`')
    expect(ddl).not.toContain('INDEX `PRIMARY`')
    expect(ddl).toContain('ADD CONSTRAINT `uq_block_code` UNIQUE (`code`)')
    expect(ddl).toContain('CREATE INDEX `idx_plain`')
  })

  it('leaves keyword defaults unquoted and quotes literals', () => {
    const column = (name: string, def: string | number | null) => ({
      name,
      type: 'varchar(20)',
      default: def,
      check: null,
      notNull: false,
      comment: null,
    })

    const ddl = ddlOf(
      schemaOf(
        table({
          name: 't',
          columns: {
            a: column('a', 'CURRENT_TIMESTAMP'),
            b: column('b', 'uploaded'),
            c: column('c', 7),
            d: column('d', "it's"),
          },
        }),
      ),
    )

    expect(ddl).toContain('`a` varchar(20) DEFAULT CURRENT_TIMESTAMP')
    expect(ddl).toContain("`b` varchar(20) DEFAULT 'uploaded'")
    expect(ddl).toContain('`c` varchar(20) DEFAULT 7')
    expect(ddl).toContain("`d` varchar(20) DEFAULT 'it''s'")
  })

  it('renders comments inline rather than as COMMENT ON', () => {
    const ddl = ddlOf(
      schemaOf(
        table({
          name: 't',
          comment: 'a table',
          columns: {
            a: {
              name: 'a',
              type: 'int',
              default: null,
              check: null,
              notNull: false,
              comment: 'a column',
            },
          },
        }),
      ),
    )

    expect(ddl).toContain("COMMENT 'a column'")
    expect(ddl).toContain("COMMENT='a table'")
    expect(ddl).not.toContain('COMMENT ON')
  })

  it('expands reference options and omits the NO ACTION default', () => {
    const ddl = ddlOf(
      schemaOf(
        table({
          name: 'child',
          constraints: {
            fk_cascade: {
              type: 'FOREIGN KEY',
              name: 'fk_cascade',
              columnNames: ['parent_id'],
              targetTableName: 'parent',
              targetColumnNames: ['id'],
              updateConstraint: 'NO_ACTION',
              deleteConstraint: 'SET_NULL',
            },
          },
        }),
        table({ name: 'parent' }),
      ),
    )

    expect(ddl).toContain(
      'ALTER TABLE `child` ADD CONSTRAINT `fk_cascade` FOREIGN KEY (`parent_id`) REFERENCES `parent` (`id`) ON DELETE SET NULL;',
    )
    expect(ddl).not.toContain('NO_ACTION')
    expect(ddl).not.toContain('ON UPDATE')
  })

  it('emits foreign keys after every CREATE TABLE', () => {
    const ddl = ddlOf(
      schemaOf(
        table({
          name: 'child',
          constraints: {
            fk: {
              type: 'FOREIGN KEY',
              name: 'fk',
              columnNames: ['parent_id'],
              targetTableName: 'parent',
              targetColumnNames: ['id'],
              updateConstraint: 'NO_ACTION',
              deleteConstraint: 'NO_ACTION',
            },
          },
        }),
        table({ name: 'parent' }),
      ),
    )

    expect(ddl.indexOf('CREATE TABLE `parent`')).toBeLessThan(
      ddl.indexOf('ADD CONSTRAINT `fk`'),
    )
  })
})
