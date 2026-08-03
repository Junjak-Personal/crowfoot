// Added in erdkit; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import type { Schema } from '../../schema/index.js'
import type { LegacySchemaDeparser } from '../type.js'
import {
  generateAddConstraintStatement,
  generateCreateIndexStatement,
  generateCreateTableStatement,
} from './utils.js'

/**
 * MySQL schema deparser.
 *
 * Differences from the PostgreSQL one, all forced by MySQL itself:
 * - no CREATE EXTENSION and no CREATE TYPE ... AS ENUM (enums are column types)
 * - comments are inline (`COMMENT '...'`), there is no COMMENT ON
 * - the primary key is declared inside CREATE TABLE
 * - a UNIQUE constraint *is* a unique index, so emitting both the constraint
 *   and the same-named index would fail with "Duplicate key name"
 */
export const mysqlSchemaDeparser: LegacySchemaDeparser = (schema: Schema) => {
  const ddlStatements: string[] = []
  const errors: { message: string }[] = []

  for (const table of Object.values(schema.tables)) {
    ddlStatements.push(generateCreateTableStatement(table))
  }

  for (const table of Object.values(schema.tables)) {
    // Names that a constraint will already create an index for.
    const constraintIndexNames = new Set(
      Object.values(table.constraints)
        .filter(
          (constraint) =>
            constraint.type === 'PRIMARY KEY' || constraint.type === 'UNIQUE',
        )
        .map((constraint) => constraint.name),
    )

    for (const index of Object.values(table.indexes)) {
      // MySQL always calls the primary key index PRIMARY.
      if (index.name === 'PRIMARY') continue
      if (constraintIndexNames.has(index.name)) continue

      ddlStatements.push(generateCreateIndexStatement(table.name, index))
    }
  }

  // Foreign keys go last so every referenced table already exists.
  const foreignKeyStatements: string[] = []

  for (const table of Object.values(schema.tables)) {
    for (const constraint of Object.values(table.constraints)) {
      const statement = generateAddConstraintStatement(table.name, constraint)
      if (statement === null) continue

      if (constraint.type === 'FOREIGN KEY') {
        foreignKeyStatements.push(statement)
      } else {
        ddlStatements.push(statement)
      }
    }
  }

  ddlStatements.push(...foreignKeyStatements)

  return {
    value: ddlStatements.join('\n\n'),
    errors,
  }
}
