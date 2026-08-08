// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import type {
  CheckConstraint,
  Column,
  Constraint,
  ForeignKeyConstraint,
  ForeignKeyConstraintReferenceOption,
  Index,
  Table,
  UniqueConstraint,
} from '@crowfoot/schema'
import {
  FileText,
  IconButton,
  Lock,
  Plus,
  Rows3,
  Table2,
  Trash2,
  useToast,
  Waypoints,
} from '@crowfoot/ui'
import type { FC, ReactNode } from 'react'
import { useUserEditingOrThrow } from '../../../../../../../../stores'
import {
  createColumn,
  dropColumn,
  dropTable,
  hasOwn,
  putTable,
  renameColumn,
  uniqueName,
} from '../../../../../../../../utils/schemaEdit'
import { useSchemaEditing } from '../../../../../../hooks'
import { CollapsibleHeader } from '../CollapsibleHeader'
import {
  CheckField,
  ColumnList,
  IconAction,
  SelectField,
  TextField,
} from './EditorFields'
import styles from './TableEditor.module.css'

type Props = {
  table: Table
}

const REFERENCE_OPTIONS = [
  'CASCADE',
  'RESTRICT',
  'SET_NULL',
  'SET_DEFAULT',
  'NO_ACTION',
] as const

const isReferenceOption = (
  value: string,
): value is ForeignKeyConstraintReferenceOption =>
  REFERENCE_OPTIONS.some((option) => option === value)

/**
 * Replaces (or drops) the entry filed under `key`, refiling it under its own
 * `name` so the record key and the name it carries never drift apart — every
 * lookup in the schema package goes through one or the other.
 */
const replaceNamed = <T extends { name: string }>(
  record: Record<string, T>,
  key: string,
  next: T,
): Record<string, T> =>
  Object.fromEntries(
    Object.entries(record).map(([entryKey, entry]) =>
      entryKey === key ? [next.name, next] : [entryKey, entry],
    ),
  )

// `<T,>` rather than `<T>`: in a .tsx file the latter parses as a JSX tag.
const dropNamed = <T,>(
  record: Record<string, T>,
  key: string,
): Record<string, T> =>
  Object.fromEntries(
    Object.entries(record).filter(([entryKey]) => entryKey !== key),
  )

/**
 * `default` arrives from the parser already typed, and round-tripping it
 * through a text box must not turn `DEFAULT 0` into `DEFAULT '0'`.
 */
const parseDefault = (raw: string): Column['default'] => {
  const trimmed = raw.trim()
  if (trimmed === '') return null
  if (trimmed === 'true') return true
  if (trimmed === 'false') return false

  const numeric = Number(trimmed)
  return Number.isFinite(numeric) ? numeric : raw
}

const showDefault = (value: Column['default']): string =>
  value === null ? '' : String(value)

type SectionProps = {
  title: string
  icon: ReactNode
  /** Omitted for the table's own section, which has nothing to add to. */
  onAdd?: (() => void) | undefined
  addLabel?: string | undefined
  children: ReactNode
}

/**
 * The editor's sections are the read-only view's `CollapsibleHeader`, so both
 * halves of the drawer fold and read the same way. The header is itself a
 * button, hence the `stopPropagation` — adding a column must not also collapse
 * the section it was added to.
 */
const Section: FC<SectionProps> = ({
  title,
  icon,
  onAdd,
  addLabel,
  children,
}) => (
  <CollapsibleHeader
    title={title}
    icon={icon}
    isContentVisible
    // Every section header sticks to the top of the panel rather than stacking
    // below the ones before it: the editor has six of them, and stacked they
    // would take most of the drawer.
    stickyTopHeight={0}
    additionalButtons={
      onAdd && addLabel ? (
        <IconButton
          icon={<Plus />}
          tooltipContent={addLabel}
          onClick={(event) => {
            event.stopPropagation()
            onAdd()
          }}
        />
      ) : undefined
    }
  >
    <div className={styles.section}>{children}</div>
  </CollapsibleHeader>
)

export const TableEditor: FC<Props> = ({ table }) => {
  const { setActiveTableName } = useUserEditingOrThrow()
  const { schema, commit, renameTable } = useSchemaEditing()
  const toast = useToast()

  const columnNames = Object.keys(table.columns)
  const tableNames = Object.keys(schema.tables)
  const constraints = Object.entries(table.constraints)
  const primaryKey = constraints.find(
    (entry): entry is [string, Constraint & { type: 'PRIMARY KEY' }] =>
      entry[1].type === 'PRIMARY KEY',
  )
  const foreignKeys = constraints.filter(
    (entry): entry is [string, ForeignKeyConstraint] =>
      entry[1].type === 'FOREIGN KEY',
  )
  const uniques = constraints.filter(
    (entry): entry is [string, UniqueConstraint] => entry[1].type === 'UNIQUE',
  )
  const checks = constraints.filter(
    (entry): entry is [string, CheckConstraint] => entry[1].type === 'CHECK',
  )

  const reject = (message: string): boolean => {
    toast({ title: message, status: 'error' })
    return false
  }

  const putSelf = (next: Table): boolean => commit((s) => putTable(s, next))

  const putConstraint = (key: string, next: Constraint): boolean => {
    if (next.name === '') return reject('A constraint needs a name')
    if (next.name !== key && hasOwn(table.constraints, next.name)) {
      return reject(`"${next.name}" is already used by another constraint`)
    }
    return putSelf({
      ...table,
      constraints: replaceNamed(table.constraints, key, next),
    })
  }

  const addConstraint = (next: Constraint): boolean =>
    putSelf({
      ...table,
      constraints: { ...table.constraints, [next.name]: next },
    })

  const putIndex = (key: string, next: Index): boolean => {
    if (next.name === '') return reject('An index needs a name')
    if (next.name !== key && hasOwn(table.indexes, next.name)) {
      return reject(`"${next.name}" is already used by another index`)
    }
    return putSelf({
      ...table,
      indexes: replaceNamed(table.indexes, key, next),
    })
  }

  const handleRenameTable = (name: string): boolean => {
    if (!renameTable(table.name, name)) {
      return reject(`"${name}" is not a usable table name`)
    }
    // The drawer is keyed on `?active=`, which still names the old table.
    setActiveTableName(name)
    return true
  }

  const handleDeleteTable = () => {
    commit((s) => dropTable(s, table.name))
    setActiveTableName(null)
  }

  const handleAddColumn = () => {
    const name = uniqueName(columnNames, 'column')
    putSelf({
      ...table,
      columns: { ...table.columns, [name]: createColumn(name) },
    })
  }

  const handleRenameColumn = (from: string, to: string): boolean =>
    commit((s) => renameColumn(s, table.name, from, to)) ||
    reject(`"${to}" is not a usable column name`)

  const handleColumnChange = (key: string, next: Column): boolean =>
    putSelf({ ...table, columns: replaceNamed(table.columns, key, next) })

  /**
   * ponytail: a column joins the primary key in table-column order, which is
   * what a composite key almost always wants. Reordering a composite key is
   * not expressible here — reorder the columns, or edit `?schemaedits=`.
   */
  const handleTogglePrimaryKey = (columnName: string, isKey: boolean) => {
    const current = primaryKey?.[1].columnNames ?? []
    const nextNames = isKey
      ? columnNames.filter(
          (name) => name === columnName || current.includes(name),
        )
      : current.filter((name) => name !== columnName)

    if (nextNames.length === 0) {
      putSelf({
        ...table,
        constraints: primaryKey
          ? dropNamed(table.constraints, primaryKey[0])
          : table.constraints,
      })
      return
    }

    const next: Constraint = {
      type: 'PRIMARY KEY',
      name: primaryKey?.[1].name ?? `${table.name}_pkey`,
      columnNames: nextNames,
    }

    if (primaryKey) {
      putConstraint(primaryKey[0], next)
      return
    }
    addConstraint(next)
  }

  const handleAddForeignKey = () => {
    const target = tableNames.find((name) => name !== table.name)
    if (!target) {
      reject('There is no other table to reference')
      return
    }

    addConstraint({
      type: 'FOREIGN KEY',
      name: uniqueName(
        Object.keys(table.constraints),
        `fk_${table.name}_${target}`,
      ),
      columnNames: [],
      targetTableName: target,
      targetColumnNames: [],
      updateConstraint: 'NO_ACTION',
      deleteConstraint: 'NO_ACTION',
    })
  }

  const handleAddUnique = () => {
    addConstraint({
      type: 'UNIQUE',
      name: uniqueName(Object.keys(table.constraints), `${table.name}_key`),
      columnNames: [],
    })
  }

  const handleAddCheck = () => {
    addConstraint({
      type: 'CHECK',
      name: uniqueName(Object.keys(table.constraints), `${table.name}_check`),
      // The schema rejects a blank detail, so a new check starts as a
      // tautology the user overwrites rather than as an invalid entry.
      detail: 'true',
    })
  }

  const handleAddIndex = () => {
    const name = uniqueName(Object.keys(table.indexes), `${table.name}_idx`)
    putSelf({
      ...table,
      indexes: {
        ...table.indexes,
        [name]: { name, unique: false, columns: [], type: '' },
      },
    })
  }

  return (
    <div className={styles.wrapper}>
      <Section title="Table" icon={<Table2 width={12} />}>
        <TextField
          label="Name"
          value={table.name}
          onCommit={handleRenameTable}
        />
        <TextField
          label="Comment"
          value={table.comment ?? ''}
          placeholder="None"
          onCommit={(value) =>
            putSelf({ ...table, comment: value === '' ? null : value })
          }
        />
        <button
          type="button"
          className={styles.dangerButton}
          onClick={handleDeleteTable}
        >
          <Trash2 size={13} />
          Delete table
        </button>
      </Section>

      <Section
        title="Columns"
        icon={<Rows3 width={12} />}
        onAdd={handleAddColumn}
        addLabel="Add column"
      >
        {columnNames.length === 0 && (
          <p className={styles.empty}>No columns yet.</p>
        )}
        {Object.entries(table.columns).map(([key, column]) => (
          <div key={key} className={styles.card}>
            <div className={styles.cardHead}>
              <TextField
                label="Name"
                value={column.name}
                onCommit={(value) => handleRenameColumn(key, value)}
              />
              <IconAction
                label={`Delete column ${column.name}`}
                onClick={() => commit((s) => dropColumn(s, table.name, key))}
              >
                <Trash2 size={14} />
              </IconAction>
            </div>
            <TextField
              label="Type"
              value={column.type}
              onCommit={(value) =>
                handleColumnChange(key, { ...column, type: value })
              }
            />
            <TextField
              label="Default"
              value={showDefault(column.default)}
              placeholder="None"
              onCommit={(value) =>
                handleColumnChange(key, {
                  ...column,
                  default: parseDefault(value),
                })
              }
            />
            <TextField
              label="Comment"
              value={column.comment ?? ''}
              placeholder="None"
              onCommit={(value) =>
                handleColumnChange(key, {
                  ...column,
                  comment: value === '' ? null : value,
                })
              }
            />
            <div className={styles.checkRow}>
              <CheckField
                label="Primary key"
                checked={
                  primaryKey?.[1].columnNames.includes(column.name) ?? false
                }
                onChange={(checked) =>
                  handleTogglePrimaryKey(column.name, checked)
                }
              />
              <CheckField
                label="Not null"
                checked={column.notNull}
                onChange={(checked) =>
                  handleColumnChange(key, { ...column, notNull: checked })
                }
              />
            </div>
          </div>
        ))}
      </Section>

      <Section
        title="Foreign keys"
        icon={<Waypoints width={12} />}
        onAdd={handleAddForeignKey}
        addLabel="Add foreign key"
      >
        {foreignKeys.length === 0 && (
          <p className={styles.empty}>No foreign keys yet.</p>
        )}
        {foreignKeys.map(([key, constraint]) => {
          const target = schema.tables[constraint.targetTableName]
          const pairsDiffer =
            constraint.columnNames.length !==
            constraint.targetColumnNames.length

          return (
            <div key={key} className={styles.card}>
              <div className={styles.cardHead}>
                <TextField
                  label="Name"
                  value={constraint.name}
                  onCommit={(value) =>
                    putConstraint(key, { ...constraint, name: value })
                  }
                />
                <IconAction
                  label={`Delete foreign key ${constraint.name}`}
                  onClick={() =>
                    putSelf({
                      ...table,
                      constraints: dropNamed(table.constraints, key),
                    })
                  }
                >
                  <Trash2 size={14} />
                </IconAction>
              </div>
              <ColumnList
                label="Columns"
                available={columnNames}
                value={constraint.columnNames}
                onChange={(value) =>
                  putConstraint(key, { ...constraint, columnNames: value })
                }
              />
              <SelectField
                label="References table"
                value={constraint.targetTableName}
                options={tableNames}
                onChange={(value) =>
                  putConstraint(key, {
                    ...constraint,
                    targetTableName: value,
                    // Columns of the table it used to point at mean nothing here.
                    targetColumnNames: [],
                  })
                }
              />
              <ColumnList
                label="References columns"
                available={Object.keys(target?.columns ?? {})}
                value={constraint.targetColumnNames}
                onChange={(value) =>
                  putConstraint(key, {
                    ...constraint,
                    targetColumnNames: value,
                  })
                }
              />
              {pairsDiffer && (
                <p className={styles.warning}>
                  Columns are paired by position — the extra ones are ignored
                  until both lists are the same length.
                </p>
              )}
              <SelectField
                label="On update"
                value={constraint.updateConstraint}
                options={REFERENCE_OPTIONS}
                onChange={(value) =>
                  isReferenceOption(value) &&
                  putConstraint(key, { ...constraint, updateConstraint: value })
                }
              />
              <SelectField
                label="On delete"
                value={constraint.deleteConstraint}
                options={REFERENCE_OPTIONS}
                onChange={(value) =>
                  isReferenceOption(value) &&
                  putConstraint(key, { ...constraint, deleteConstraint: value })
                }
              />
            </div>
          )
        })}
      </Section>

      <Section
        title="Unique constraints"
        icon={<Lock width={12} />}
        onAdd={handleAddUnique}
        addLabel="Add unique constraint"
      >
        {uniques.length === 0 && (
          <p className={styles.empty}>No unique constraints yet.</p>
        )}
        {uniques.map(([key, constraint]) => (
          <div key={key} className={styles.card}>
            <div className={styles.cardHead}>
              <TextField
                label="Name"
                value={constraint.name}
                onCommit={(value) =>
                  putConstraint(key, { ...constraint, name: value })
                }
              />
              <IconAction
                label={`Delete unique constraint ${constraint.name}`}
                onClick={() =>
                  putSelf({
                    ...table,
                    constraints: dropNamed(table.constraints, key),
                  })
                }
              >
                <Trash2 size={14} />
              </IconAction>
            </div>
            <ColumnList
              label="Columns"
              available={columnNames}
              value={constraint.columnNames}
              onChange={(value) =>
                putConstraint(key, { ...constraint, columnNames: value })
              }
            />
          </div>
        ))}
      </Section>

      <Section
        title="Check constraints"
        icon={<Lock width={12} />}
        onAdd={handleAddCheck}
        addLabel="Add check constraint"
      >
        {checks.length === 0 && (
          <p className={styles.empty}>No check constraints yet.</p>
        )}
        {checks.map(([key, constraint]) => (
          <div key={key} className={styles.card}>
            <div className={styles.cardHead}>
              <TextField
                label="Name"
                value={constraint.name}
                onCommit={(value) =>
                  putConstraint(key, { ...constraint, name: value })
                }
              />
              <IconAction
                label={`Delete check constraint ${constraint.name}`}
                onClick={() =>
                  putSelf({
                    ...table,
                    constraints: dropNamed(table.constraints, key),
                  })
                }
              >
                <Trash2 size={14} />
              </IconAction>
            </div>
            <TextField
              label="Detail"
              value={constraint.detail}
              onCommit={(value) =>
                value.trim() === ''
                  ? reject('A check constraint needs an expression')
                  : putConstraint(key, { ...constraint, detail: value })
              }
            />
          </div>
        ))}
      </Section>

      <Section
        title="Indexes"
        icon={<FileText width={12} />}
        onAdd={handleAddIndex}
        addLabel="Add index"
      >
        {Object.keys(table.indexes).length === 0 && (
          <p className={styles.empty}>No indexes yet.</p>
        )}
        {Object.entries(table.indexes).map(([key, index]) => (
          <div key={key} className={styles.card}>
            <div className={styles.cardHead}>
              <TextField
                label="Name"
                value={index.name}
                onCommit={(value) => putIndex(key, { ...index, name: value })}
              />
              <IconAction
                label={`Delete index ${index.name}`}
                onClick={() =>
                  putSelf({
                    ...table,
                    indexes: dropNamed(table.indexes, key),
                  })
                }
              >
                <Trash2 size={14} />
              </IconAction>
            </div>
            <TextField
              label="Method"
              value={index.type}
              placeholder="Default"
              onCommit={(value) => putIndex(key, { ...index, type: value })}
            />
            <ColumnList
              label="Columns"
              available={columnNames}
              value={index.columns}
              onChange={(value) => putIndex(key, { ...index, columns: value })}
            />
            <div className={styles.checkRow}>
              <CheckField
                label="Unique"
                checked={index.unique}
                onChange={(checked) =>
                  putIndex(key, { ...index, unique: checked })
                }
              />
            </div>
          </div>
        ))}
      </Section>
    </div>
  )
}
