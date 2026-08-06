import { isPrimaryKey, type Table } from '@liam-hq/schema'

export type ColumnType = 'PRIMARY_KEY' | 'FOREIGN_KEY' | 'NOT_NULL' | 'NULLABLE'

const isForeignKey = (columnName: string, table: Table): boolean => {
  for (const constraint of Object.values(table.constraints)) {
    if (constraint.type !== 'FOREIGN KEY') continue

    if (constraint.columnNames.includes(columnName)) return true
  }

  return false
}

export const getColumnTypeMap = (table: Table) => {
  const result: Record<string, ColumnType> = {}

  Object.values(table.columns).forEach((column) => {
    result[column.name] = isPrimaryKey(column.name, table.constraints)
      ? 'PRIMARY_KEY'
      : isForeignKey(column.name, table)
        ? 'FOREIGN_KEY'
        : column.notNull
          ? 'NOT_NULL'
          : 'NULLABLE'
  })

  return result
}
