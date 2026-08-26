import type {
  A_Const,
  AlterTableStmt,
  CommentStmt,
  CreateEnumStmt,
  CreateExtensionStmt,
  CreateStmt,
  FuncCall,
  IndexStmt,
  List,
  Node,
  Constraint as PgConstraint,
  String as PgString,
  TypeName as PgTypeName,
  RawStmt,
} from '@pgsql/types'
import { err, ok, type Result } from 'neverthrow'
import type {
  CheckConstraint,
  Columns,
  Constraint,
  Constraints,
  Enum,
  Extension,
  ForeignKeyConstraint,
  ForeignKeyConstraintReferenceOption,
  Schema,
  Table,
} from '../../../schema/index.js'
import { type ProcessError, UnexpectedTokenWarningError } from '../../errors.js'
import type { ProcessResult, Unparsed } from '../../types.js'
import { defaultRelationshipName } from '../../utils/index.js'

const getUtf8ByteLength = (codePoint: number): number => {
  // Validate Unicode code point range
  // Surrogate pairs (0xD800-0xDFFF) are invalid standalone code points
  // Code points above 0x10FFFF exceed the Unicode limit
  if (codePoint >= 0xd800 && codePoint <= 0xdfff) return -1
  if (codePoint > 0x10ffff) return -1

  if (codePoint <= 0x7f) return 1
  if (codePoint <= 0x7ff) return 2
  if (codePoint <= 0xffff) return 3
  return 4
}

const utf8ByteOffsetToCharIndex = (
  input: string,
  byteOffset: number,
): number | null => {
  if (byteOffset < 0) return null

  let bytesConsumed = 0

  for (let i = 0; i < input.length; ) {
    if (bytesConsumed === byteOffset) {
      return i
    }

    const codePoint = input.codePointAt(i)
    if (codePoint === undefined) {
      return null
    }

    const utf8Length = getUtf8ByteLength(codePoint)
    if (utf8Length < 0) {
      // Invalid code point (surrogate or out of range)
      return null
    }

    if (bytesConsumed + utf8Length > byteOffset) {
      return null
    }

    bytesConsumed += utf8Length
    const codeUnitLength = codePoint > 0xffff ? 2 : 1
    i += codeUnitLength

    if (bytesConsumed === byteOffset) {
      return i
    }
  }

  if (bytesConsumed === byteOffset) {
    return input.length
  }

  return null
}

function isStringNode(node: Node | undefined): node is { String: PgString } {
  return (
    node !== undefined &&
    'String' in node &&
    typeof node.String === 'object' &&
    node.String !== null &&
    'sval' in node.String &&
    node.String.sval !== 'pg_catalog'
  )
}

function isConstraintNode(node: Node): node is { Constraint: PgConstraint } {
  return 'Constraint' in node && node.Constraint !== undefined
}

// ON UPDATE or ON DELETE subclauses for foreign key
// see: https://github.com/launchql/pgsql-parser/blob/pgsql-parser%4013.16.0/packages/deparser/src/deparser.ts#L3101-L3141
function getConstraintAction(
  action?: string,
): ForeignKeyConstraintReferenceOption {
  switch (action?.toLowerCase()) {
    case 'r':
      return 'RESTRICT'
    case 'c':
      return 'CASCADE'
    case 'n':
      return 'SET_NULL'
    case 'd':
      return 'SET_DEFAULT'
    case 'a':
      return 'NO_ACTION'
    default:
      return 'NO_ACTION' // Default to 'NO_ACTION' for unknown or missing values
  }
}

type DefaultValue = string | number | boolean | null

const LEADING_INTEGER = /^[+-]?\d+/

/**
 * The literal an `A_Const` holds.
 *
 * Two silent traps here. The parser's JSON drops a scalar it considers empty
 * but keeps its wrapper, so `DEFAULT false` arrives as `boolval: {}` and
 * `DEFAULT 0` as `ival: {}` — reading the inner field misses every falsy
 * default. And it drops negative integers the same way: `-1` and `-2` are also
 * `ival: {}`, indistinguishable from zero. An integer with no value is
 * therefore read back out of the SQL at the offset the node carries, because
 * recording 0 where the column said -1 is worse than recording nothing.
 */
const constValue = (aConst: A_Const, chunkSql: string): DefaultValue => {
  if (aConst.isnull) return null
  if (aConst.sval !== undefined) return aConst.sval.sval ?? ''
  if (aConst.boolval !== undefined) return aConst.boolval.boolval ?? false
  if (aConst.fval !== undefined) {
    return aConst.fval.fval === undefined ? null : Number(aConst.fval.fval)
  }
  if (aConst.ival === undefined) return null
  if (aConst.ival.ival !== undefined) return aConst.ival.ival

  if (aConst.location === undefined) return null
  const start = utf8ByteOffsetToCharIndex(chunkSql, aConst.location)
  if (start === null) return null
  const literal = LEADING_INTEGER.exec(chunkSql.slice(start))

  return literal === null ? null : Number(literal[0])
}

/**
 * `now()`, `gen_random_uuid()`, `nextval('users_id_seq')`.
 *
 * These outnumbered every literal two to one in the schema this was measured
 * against and all of them used to come back null. A call is dropped whole when
 * any argument fails to render, rather than shown with pieces missing.
 */
const funcCallText = (call: FuncCall, chunkSql: string): string | null => {
  const name = (call.funcname ?? [])
    .filter(isStringNode)
    .map((node) => node.String.sval)
    .join('.')
  if (name === '') return null

  const args: string[] = []
  for (const arg of call.args ?? []) {
    const value = defaultValueOf(arg, chunkSql)
    if (value === null) return null
    args.push(
      typeof value === 'string'
        ? `'${value.replace(/'/g, "''")}'`
        : String(value),
    )
  }

  return `${name}(${args.join(', ')})`
}

/** The expression a `DEFAULT` clause carries, or null if it is not one of these. */
function defaultValueOf(node: Node, chunkSql: string): DefaultValue {
  if ('A_Const' in node) return constValue(node.A_Const, chunkSql)
  // `'x'::character varying`, `'{}'::jsonb` — the value is in the argument, and
  // the cast says nothing the column's own type does not.
  if ('TypeCast' in node) {
    const arg = node.TypeCast.arg
    return arg === undefined ? null : defaultValueOf(arg, chunkSql)
  }
  if ('FuncCall' in node) return funcCallText(node.FuncCall, chunkSql)
  // `SVFOP_CURRENT_TIMESTAMP` names the keyword it stands for; the `_N` suffix
  // marks the `CURRENT_TIMESTAMP(n)` form, whose precision is not carried here.
  if ('SQLValueFunction' in node) {
    const op = node.SQLValueFunction.op
    return op === undefined
      ? null
      : op.replace(/^SVFOP_/, '').replace(/_N$/, '')
  }

  return null
}

/**
 * The source text of an expression starting at `location`.
 *
 * Postgres records where a node begins and not where it ends, so the end is
 * found by reading forward to the comma or closing paren that ends the column
 * definition, skipping anything inside quotes or brackets.
 *
 * ponytail: no dollar-quoting (`$$…$$`). It does not appear in a DEFAULT in
 * any schema this has been pointed at, and the cost of being wrong is one
 * report reading further than it should — not a wrong schema.
 */
/** The index just past the single-quoted string that starts at `i`. */
const endOfQuoted = (sql: string, i: number): number => {
  for (let j = i + 1; j < sql.length; j++) {
    if (sql[j] !== "'") continue
    // '' is an escaped quote, not the end of the string.
    if (sql[j + 1] === "'") j++
    else return j + 1
  }

  return sql.length
}

const sourceTextAt = (chunkSql: string, location: number): string | null => {
  const start = utf8ByteOffsetToCharIndex(chunkSql, location)
  if (start === null) return null

  let depth = 0

  for (let i = start; i < chunkSql.length; i++) {
    const char = chunkSql[i]

    if (char === "'") {
      i = endOfQuoted(chunkSql, i) - 1
      continue
    }

    if (char === '(' || char === '[') {
      depth++
      continue
    }

    // A close with nothing open is the one ending the column list.
    if (char === ')' || char === ']') {
      if (depth === 0) return chunkSql.slice(start, i).trim()
      depth--
      continue
    }

    if (char === ',' && depth === 0) return chunkSql.slice(start, i).trim()
  }

  return chunkSql.slice(start).trim()
}

function extractDefaultValueFromConstraints(
  constraints: Node[] | undefined,
  chunkSql: string,
  onUnparsed: (raw: string) => void,
): DefaultValue {
  if (!constraints) return null

  for (const node of constraints.filter(isConstraintNode)) {
    const constraint = node.Constraint
    if (constraint.contype !== 'CONSTR_DEFAULT' || !constraint.raw_expr) {
      continue
    }

    const value = defaultValueOf(constraint.raw_expr, chunkSql)
    if (value !== null) return value

    // There was a DEFAULT and nothing came back from it. `null` is what a
    // column with no default looks like, so leaving it at that states
    // something about the schema that is not true — this is the one place
    // that can tell the two apart.
    //
    // Read from the constraint, which starts at the `DEFAULT` keyword, and
    // drop the keyword — `clause` already says it. Not from the expression
    // node: postgres puts an operator expression's location on the *operator*,
    // so `('a' || ',')` would be reported as `|| ','`.
    const location = constraint.location
    const raw =
      location === undefined
        ? null
        : sourceTextAt(chunkSql, location)?.replace(/^DEFAULT\s+/i, '')
    if (raw) onUnparsed(raw)

    return null
  }

  return null
}

const constraintToForeignKeyConstraint = (
  foreignTableName: string,
  foreignColumnNames: string[],
  constraint: PgConstraint,
): Result<ForeignKeyConstraint, UnexpectedTokenWarningError> => {
  if (constraint.contype !== 'CONSTR_FOREIGN') {
    return err(
      new UnexpectedTokenWarningError('contype "CONSTR_FOREIGN" is expected'),
    )
  }

  const primaryTableName = constraint.pktable?.relname
  const primaryColumnNames =
    constraint.pk_attrs
      ?.filter(isStringNode)
      .map((node) => node.String.sval)
      .filter((name): name is string => name !== undefined) || []

  if (!primaryTableName || primaryColumnNames.length === 0) {
    return err(
      new UnexpectedTokenWarningError('Invalid foreign key constraint'),
    )
  }

  const name =
    constraint.conname ??
    (primaryColumnNames[0] && foreignColumnNames[0]
      ? defaultRelationshipName(
          primaryTableName,
          primaryColumnNames[0],
          foreignTableName,
          foreignColumnNames[0],
        )
      : `fk_${foreignTableName}_${primaryTableName}`)
  const updateConstraint = getConstraintAction(constraint.fk_upd_action)
  const deleteConstraint = getConstraintAction(constraint.fk_del_action)

  const foreignKeyConstraint: ForeignKeyConstraint = {
    type: 'FOREIGN KEY',
    name,
    columnNames: foreignColumnNames,
    targetTableName: primaryTableName,
    targetColumnNames: primaryColumnNames,
    updateConstraint,
    deleteConstraint,
  }

  return ok(foreignKeyConstraint)
}

const constraintToCheckConstraint = (
  columnName: string | undefined,
  constraint: PgConstraint,
  rawSql: string,
  chunkSql: string,
  chunkOffset: number,
): Result<CheckConstraint, UnexpectedTokenWarningError> => {
  if (constraint.contype !== 'CONSTR_CHECK') {
    return err(
      new UnexpectedTokenWarningError('contype "CONSTR_CHECK" is expected'),
    )
  }

  if (constraint.location === undefined) {
    return err(new UnexpectedTokenWarningError('Invalid check constraint'))
  }

  const locationInChunk = utf8ByteOffsetToCharIndex(
    chunkSql,
    constraint.location,
  )

  if (locationInChunk === null) {
    return err(
      new UnexpectedTokenWarningError(
        `Failed to resolve location for CHECK constraint "${constraint.conname || 'unnamed'}"`,
      ),
    )
  }

  // Find balanced parentheses for the CHECK constraint condition
  const findBalancedParentheses = (
    sql: string,
    startIndex: number,
  ): { start: number; end: number } | null => {
    let openParenIndex = -1
    let depth = 0

    // Find the first opening parenthesis
    for (let i = startIndex; i < sql.length; i++) {
      if (sql[i] === '(') {
        if (openParenIndex === -1) {
          openParenIndex = i
        }
        depth++
      } else if (sql[i] === ')') {
        depth--
        if (depth === 0 && openParenIndex !== -1) {
          return { start: openParenIndex, end: i }
        }
      }
    }
    return null
  }

  const absoluteLocation = locationInChunk + chunkOffset
  const parentheses = findBalancedParentheses(rawSql, absoluteLocation)

  if (!parentheses) {
    return err(
      new UnexpectedTokenWarningError(
        `Failed to find balanced parentheses for CHECK constraint "${constraint.conname || 'unnamed'}"`,
      ),
    )
  }

  const condition = rawSql.slice(parentheses.start + 1, parentheses.end)
  const trimmedCondition = condition.trim()

  if (trimmedCondition.length === 0) {
    const fallbackName =
      constraint.conname ??
      (columnName ? `${columnName}_check` : 'unnamed_check_constraint')
    return err(
      new UnexpectedTokenWarningError(
        `CHECK constraint "${fallbackName}" has empty detail`,
      ),
    )
  }

  // Generate a better name for anonymous constraints
  let constraintName = constraint.conname
  if (!constraintName) {
    if (columnName) {
      constraintName = `${columnName}_check`
    } else {
      // For table-level constraints, try to extract a meaningful name from the condition
      // Handle case where condition might be empty or invalid
      const simplifiedCondition = trimmedCondition
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9_]/g, '')
        .substring(0, 20)
      constraintName = simplifiedCondition
        ? `check_${simplifiedCondition}`
        : 'check_constraint'
    }
  }

  const checkConstraint: CheckConstraint = {
    name: constraintName,
    type: 'CHECK',
    detail: condition,
  }

  return ok(checkConstraint)
}

// Transform function for AST to Schema
export const convertToSchema = (
  stmts: RawStmt[],
  rawSql: string,
  mainSchema: Schema,
  chunkOffset: number,
  chunkSql: string,
): ProcessResult => {
  const tables: Record<string, Table> = {}
  const enums: Record<string, Enum> = {}
  const extensions: Record<string, Extension> = {}
  const errors: ProcessError[] = []
  const unparsed: Unparsed[] = []

  function isCreateStmt(stmt: Node): stmt is { CreateStmt: CreateStmt } {
    return 'CreateStmt' in stmt
  }

  function isIndexStmt(stmt: Node): stmt is { IndexStmt: IndexStmt } {
    return 'IndexStmt' in stmt
  }

  function isCommentStmt(stmt: Node): stmt is { CommentStmt: CommentStmt } {
    return 'CommentStmt' in stmt
  }

  function isAlterTableStmt(
    stmt: Node,
  ): stmt is { AlterTableStmt: AlterTableStmt } {
    return 'AlterTableStmt' in stmt
  }

  function isCreateEnumStmt(
    stmt: Node,
  ): stmt is { CreateEnumStmt: CreateEnumStmt } {
    return 'CreateEnumStmt' in stmt
  }

  function isCreateExtensionStmt(
    stmt: Node,
  ): stmt is { CreateExtensionStmt: CreateExtensionStmt } {
    return 'CreateExtensionStmt' in stmt
  }

  /**
   * Extract column type from type name
   * For schema-qualified types like "public.user_status",
   * returns the full qualified name "public.user_status"
   *
   * `arrayBounds` is what makes `text[]` come back as `text[]` rather than
   * `text`. Postgres puts the dimensions there and nowhere else, so a parser
   * reading only `names` loses the array with the column count still correct —
   * which is exactly the kind of loss no count can catch. The deparser has
   * always expected the suffix (`escapeTypeIdentifier` strips and re-appends
   * it); only this end never produced one.
   */
  function extractColumnType(typeName: PgTypeName | undefined): string {
    const names = typeName?.names
      ?.filter(isStringNode)
      .map((n) => n.String.sval)
      .filter((name): name is string => name !== undefined)

    if (!names || names.length === 0) {
      return ''
    }

    // Join with dots first, then strip schema prefix
    const fullTypeName = names.join('.')
    // One `[]` per dimension: `int[][]` carries two bounds. Postgres does not
    // enforce the count, so this only ever restores what was written.
    const dimensions = typeName?.arrayBounds?.length ?? 0
    return stripSchemaPrefix(fullTypeName) + '[]'.repeat(dimensions)
  }

  /**
   * Remove schema prefix from type name
   * e.g., "public.user_status" -> "user_status"
   */
  function stripSchemaPrefix(typeName: string): string {
    const parts = typeName.split('.')
    // If it has multiple parts and the first part looks like a schema name,
    // return only the type name (last part)
    if (parts.length > 1) {
      return parts[parts.length - 1] ?? typeName // Return the last part (type name) with fallback
    }
    return typeName
  }

  /**
   * Check if a column is a primary key
   */
  function isPrimaryKey(constraints: Node[] | undefined): boolean {
    return (
      constraints
        ?.filter(isConstraintNode)
        .some((c) => c.Constraint.contype === 'CONSTR_PRIMARY') || false
    )
  }

  /**
   * Check if a column is unique
   */
  function isUnique(constraints: Node[] | undefined): boolean {
    return (
      constraints
        ?.filter(isConstraintNode)
        .some((c) =>
          ['CONSTR_UNIQUE', 'CONSTR_PRIMARY'].includes(
            c.Constraint.contype ?? '',
          ),
        ) || false
    )
  }
  /**
   * Check if a column is not null
   */
  function isNotNull(constraints: Node[] | undefined): boolean {
    return (
      constraints
        ?.filter(isConstraintNode)
        .some((c) => c.Constraint.contype === 'CONSTR_NOTNULL') ||
      // If primary key, it's not null
      isPrimaryKey(constraints) ||
      false
    )
  }

  /**
   * Column definition type
   */
  type ColumnDef = {
    colname?: string
    typeName?: PgTypeName
    constraints?: Node[]
  }

  /**
   * Column type
   */
  type Column = {
    name: string
    type: string
    default: string | number | boolean | null
    check: string | null
    notNull: boolean
    comment: string | null
  }

  function processConstraints(
    tableName: string,
    columnName: string,
    _constraints: Node[],
  ): {
    constraints: Constraint[]
    columnErrors: ProcessError[]
  } {
    const constraints: Constraint[] = []
    const columnErrors: ProcessError[] = []

    for (const constraint of _constraints.filter(isConstraintNode)) {
      if (constraint.Constraint.contype === 'CONSTR_FOREIGN') {
        const relResult = constraintToForeignKeyConstraint(
          tableName,
          [columnName],
          constraint.Constraint,
        )

        if (relResult.isErr()) {
          columnErrors.push(relResult.error)
          continue
        }

        const foreignKeyConstraint = relResult.value
        constraints.push(foreignKeyConstraint)
      } else if (constraint.Constraint.contype === 'CONSTR_CHECK') {
        const relResult = constraintToCheckConstraint(
          columnName,
          constraint.Constraint,
          rawSql,
          chunkSql,
          chunkOffset,
        )

        if (relResult.isErr()) {
          errors.push(relResult.error)
          continue
        }
        const checkConstraint = relResult.value
        constraints.push(checkConstraint)
      }
    }

    return { constraints, columnErrors }
  }

  /**
   * Process a column definition
   */
  function processColumnDef(
    colDef: ColumnDef,
    tableName: string,
  ): {
    column: [string, Column]
    constraints: Constraint[]
    errors: ProcessError[]
  } {
    const columnName = colDef.colname
    if (columnName === undefined) {
      // Return an empty column with default values
      return {
        column: [
          '',
          {
            name: '',
            type: '',
            default: null,
            check: null,
            notNull: false,
            comment: null,
          },
        ],
        constraints: [],
        errors: [],
      }
    }

    const { constraints, columnErrors } = processConstraints(
      tableName,
      columnName,
      colDef.constraints ?? [],
    )

    // Create column object
    const column = {
      name: columnName,
      type: extractColumnType(colDef.typeName),
      default: extractDefaultValueFromConstraints(
        colDef.constraints,
        chunkSql,
        (raw) =>
          unparsed.push({
            table: tableName,
            column: columnName,
            clause: 'DEFAULT',
            raw,
          }),
      ),
      check: null, // TODO
      notNull: isNotNull(colDef.constraints),
      comment: null, // TODO
    }

    if (isPrimaryKey(colDef.constraints)) {
      // Use PostgreSQL's default naming convention for primary key constraints
      const constraintName = `${tableName}_pkey`
      constraints.push({
        name: constraintName,
        type: 'PRIMARY KEY',
        columnNames: [columnName],
      })
    }

    // Create UNIQUE constraint if column has unique constraint but is not primary key
    if (isUnique(colDef.constraints) && !isPrimaryKey(colDef.constraints)) {
      // Use PostgreSQL's default naming convention for unique constraints
      const constraintName = `${tableName}_${columnName}_key`
      constraints.push({
        name: constraintName,
        type: 'UNIQUE',
        columnNames: [columnName],
      })
    }

    return {
      column: [columnName, column],
      constraints,
      errors: columnErrors,
    }
  }

  /**
   * Process table-level constraint
   */
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: TODO: Refactor to reduce complexity
  function processTableLevelConstraint(
    constraint: PgConstraint,
    tableName: string,
  ): {
    constraints: Constraint[]
    errors: ProcessError[]
  } {
    const constraints: Constraint[] = []
    const errors: ProcessError[] = []

    if (constraint.contype === 'CONSTR_PRIMARY') {
      // Handle table-level primary key constraint
      const columnNames =
        constraint.keys
          ?.filter(isStringNode)
          .map((node) => node.String.sval)
          .filter((name): name is string => name !== undefined) || []

      if (columnNames.length > 0) {
        const constraintName = constraint.conname ?? `${tableName}_pkey`
        constraints.push({
          name: constraintName,
          type: 'PRIMARY KEY',
          columnNames,
        })
      }
    } else if (constraint.contype === 'CONSTR_FOREIGN') {
      // Handle table-level foreign key constraint
      const foreignColumnNames =
        constraint.fk_attrs
          ?.filter(isStringNode)
          .map((node) => node.String.sval)
          .filter((name): name is string => name !== undefined) || []

      if (foreignColumnNames.length > 0) {
        const relResult = constraintToForeignKeyConstraint(
          tableName,
          foreignColumnNames,
          constraint,
        )

        if (relResult.isErr()) {
          errors.push(relResult.error)
        } else {
          constraints.push(relResult.value)
        }
      }
    } else if (constraint.contype === 'CONSTR_CHECK') {
      // Handle table-level check constraint
      const relResult = constraintToCheckConstraint(
        undefined,
        constraint,
        rawSql,
        chunkSql,
        chunkOffset,
      )

      if (relResult.isErr()) {
        errors.push(relResult.error)
      } else {
        constraints.push(relResult.value)
      }
    } else if (constraint.contype === 'CONSTR_UNIQUE') {
      // Handle table-level unique constraint
      const columnNames =
        constraint.keys
          ?.filter(isStringNode)
          .map((node) => node.String.sval)
          .filter((name): name is string => name !== undefined) || []

      if (columnNames.length > 0) {
        const constraintName =
          constraint.conname ?? `${tableName}_${columnNames.join('_')}_key`
        constraints.push({
          name: constraintName,
          type: 'UNIQUE',
          columnNames,
        })
      }
    }

    return { constraints, errors }
  }

  /**
   * Process table elements
   */
  function processTableElements(
    tableElts: Node[],
    tableName: string,
  ): {
    columns: Columns
    constraints: Constraints
    tableErrors: ProcessError[]
  } {
    const columns: Columns = {}
    const constraints: Constraints = {}
    const tableErrors: ProcessError[] = []

    // Process each table element
    for (const elt of tableElts) {
      if ('ColumnDef' in elt) {
        // Handle column definitions
        const {
          column,
          constraints: columnConstraints,
          errors: colErrors,
        } = processColumnDef(elt.ColumnDef, tableName)

        if (column[0]) {
          columns[column[0]] = column[1]
        }

        for (const constraint of columnConstraints) {
          constraints[constraint.name] = constraint
        }
        tableErrors.push(...colErrors)
      } else if (isConstraintNode(elt)) {
        // Handle table-level constraints
        const { constraints: tableLevelConstraints, errors: constraintErrors } =
          processTableLevelConstraint(elt.Constraint, tableName)

        for (const constraint of tableLevelConstraints) {
          constraints[constraint.name] = constraint
        }
        tableErrors.push(...constraintErrors)
      }
    }

    return { columns, constraints, tableErrors }
  }

  /**
   * Create a table object
   */
  function createTableObject(
    tableName: string,
    columns: Columns,
    constraints: Constraints,
  ): void {
    tables[tableName] = {
      name: tableName,
      columns,
      comment: null,
      indexes: {},
      constraints,
    }
  }

  /**
   * Handle CREATE TABLE statement
   */
  function handleCreateStmt(createStmt: CreateStmt): void {
    // Validate required fields
    if (!createStmt || !createStmt.relation || !createStmt.tableElts) return

    const tableName = createStmt.relation.relname
    if (!tableName) return

    // Process table elements
    const { columns, constraints, tableErrors } = processTableElements(
      createStmt.tableElts,
      tableName,
    )

    // Create table object
    createTableObject(tableName, columns, constraints)

    // Add errors
    errors.push(...tableErrors)
  }

  /**
   * Process index parameters
   */
  function processIndexParams(indexParams: Node[]): string[] {
    return indexParams
      .map((param) => {
        if ('IndexElem' in param) {
          return param.IndexElem.name
        }
        return undefined
      })
      .filter((name): name is string => name !== undefined)
  }

  /**
   * Handle CREATE INDEX statement
   */
  function handleIndexStmt(indexStmt: IndexStmt): void {
    if (
      !indexStmt ||
      !indexStmt.idxname ||
      !indexStmt.relation ||
      !indexStmt.indexParams
    )
      return

    const indexName = indexStmt.idxname
    const tableName = indexStmt.relation.relname
    const unique = indexStmt.unique !== undefined
    const columns = processIndexParams(indexStmt.indexParams)
    const type = indexStmt.accessMethod ?? ''

    if (tableName) {
      tables[tableName] = {
        name: tables[tableName]?.name || tableName,
        comment: tables[tableName]?.comment || null,
        columns: tables[tableName]?.columns || {},
        indexes: {
          ...tables[tableName]?.indexes,
          [indexName]: {
            name: indexName,
            unique: unique,
            columns,
            type,
          },
        },
        constraints: tables[tableName]?.constraints || {},
      }
    }
  }

  /**
   * Extract string value from a node
   */
  function extractStringValue(item: Node): string | null {
    return 'String' in item &&
      typeof item.String === 'object' &&
      item.String !== null &&
      'sval' in item.String
      ? item.String.sval
      : null
  }

  /**
   * Process table comment
   */
  function processTableComment(tableName: string, comment: string): void {
    if (!tables[tableName]) return
    tables[tableName].comment = comment
  }

  /**
   * Process column comment
   */
  function processColumnComment(
    tableName: string,
    columnName: string,
    comment: string,
  ): void {
    if (!tables[tableName]) return
    if (!tables[tableName].columns[columnName]) return
    tables[tableName].columns[columnName].comment = comment
  }

  /**
   * Extract list items from a comment statement
   */
  function extractCommentListItems(
    commentStmt: CommentStmt,
  ): { list: Node[]; comment: string } | null {
    // Validate object node
    const objectNode = commentStmt.object
    if (!objectNode) return null

    // Check if object is a list
    const isList = (stmt: Node): stmt is { List: List } => 'List' in stmt
    if (!isList(objectNode)) return null

    // Get comment text
    const comment = commentStmt.comment
    if (!comment) return null

    // Get list items
    const list = objectNode.List.items || []
    if (list.length === 0) return null

    return { list, comment }
  }

  /**
   * Handle table comment
   */
  function handleTableComment(list: Node[], comment: string): void {
    const last1 = list[list.length - 1]
    if (!last1) return

    const tableName = extractStringValue(last1)
    if (!tableName) return

    processTableComment(tableName, comment)
  }

  /**
   * Handle column comment
   */
  function handleColumnComment(list: Node[], comment: string): void {
    const last1 = list[list.length - 1]
    const last2 = list[list.length - 2]
    if (!last1 || !last2) return

    const tableName = extractStringValue(last2)
    if (!tableName) return

    const columnName = extractStringValue(last1)
    if (!columnName) return

    processColumnComment(tableName, columnName, comment)
  }

  /**
   * Handle COMMENT statement
   */
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: TODO: Refactor to reduce complexity
  function handleCommentStmt(commentStmt: CommentStmt): void {
    // Skip if not a supported comment type (only table, column, and type comments are supported)
    if (
      commentStmt.objtype !== 'OBJECT_TABLE' &&
      commentStmt.objtype !== 'OBJECT_COLUMN' &&
      commentStmt.objtype !== 'OBJECT_TYPE'
    )
      return

    // Handle COMMENT ON TYPE (enum comments)
    if (commentStmt.objtype === 'OBJECT_TYPE') {
      // Get comment text
      const comment = commentStmt.comment
      if (!comment) return

      // Extract TypeName for enum comments
      const objectNode = commentStmt.object
      if (!objectNode || !('TypeName' in objectNode)) return

      const typeName = objectNode.TypeName
      if (!typeName?.names || typeName.names.length === 0) return

      // Extract type names and strip schema prefix for lookup
      const typeNames = typeName.names
        .filter(isStringNode)
        .map((n) => n.String.sval)
        .filter((name): name is string => name !== undefined)

      if (typeNames.length === 0) return

      // Use stripSchemaPrefix to get the unqualified enum name for lookup
      const fullTypeName = typeNames.join('.')
      const enumName = stripSchemaPrefix(fullTypeName)

      // Set comment on existing enum
      if (enums[enumName]) {
        enums[enumName].comment = comment
      }
      return
    }

    // Handle table and column comments (use existing list-based extraction)
    const result = extractCommentListItems(commentStmt)
    if (!result) return

    // Process based on object type
    if (commentStmt.objtype === 'OBJECT_TABLE') {
      handleTableComment(result.list, result.comment)
    } else if (commentStmt.objtype === 'OBJECT_COLUMN') {
      handleColumnComment(result.list, result.comment)
    }
  }

  /**
   * Find table in current chunk or main schema
   */
  function findTable(tableName: string): Table | undefined {
    return tables[tableName] ?? mainSchema.tables[tableName]
  }

  /**
   * Process a foreign key constraint
   */
  function processForeignKeyConstraint(
    foreignTableName: string,
    constraint: PgConstraint,
  ): void {
    const foreignColumnNames =
      constraint.fk_attrs
        ?.filter(isStringNode)
        .map((node) => node.String.sval)
        .filter((name): name is string => name !== undefined) || []

    if (foreignColumnNames.length === 0) return

    const relResult = constraintToForeignKeyConstraint(
      foreignTableName,
      foreignColumnNames,
      constraint,
    )

    if (relResult.isErr()) {
      errors.push(relResult.error)
      return
    }

    const foreignKeyConstraint = relResult.value
    const table = findTable(foreignTableName)

    if (table) {
      table.constraints[foreignKeyConstraint.name] = foreignKeyConstraint
    } else {
      // Table not found - this could be the cause of missing foreign keys
      errors.push(
        new UnexpectedTokenWarningError(
          `Table "${foreignTableName}" not found when processing foreign key constraint "${foreignKeyConstraint.name}"`,
        ),
      )
    }
  }

  /**
   * Process a check constraint
   */
  function processCheckConstraint(
    foreignTableName: string,
    constraint: PgConstraint,
  ): void {
    const relResult = constraintToCheckConstraint(
      undefined,
      constraint,
      rawSql,
      chunkSql,
      chunkOffset,
    )

    if (relResult.isErr()) {
      errors.push(relResult.error)
      return
    }

    const table = findTable(foreignTableName)

    if (table) {
      table.constraints[relResult.value.name] = relResult.value
    }
  }

  /**
   * Process a primary key constraint from ALTER TABLE
   */
  function processPrimaryKeyConstraint(
    foreignTableName: string,
    constraint: PgConstraint,
  ): void {
    const table = findTable(foreignTableName)

    if (!table) return

    // Handle primary key constraint from ALTER TABLE
    const columnNames =
      constraint.keys
        ?.filter(isStringNode)
        .map((node) => node.String.sval)
        .filter((name): name is string => name !== undefined) || []

    if (columnNames.length > 0) {
      const constraintName = constraint.conname ?? `${foreignTableName}_pkey`
      table.constraints[constraintName] = {
        name: constraintName,
        type: 'PRIMARY KEY',
        columnNames,
      }
    }
  }

  /**
   * Process a unique constraint from ALTER TABLE
   */
  function processUniqueConstraint(
    foreignTableName: string,
    constraint: PgConstraint,
  ): void {
    const table = findTable(foreignTableName)

    if (!table) return

    // Handle unique constraint from ALTER TABLE
    const columnNames =
      constraint.keys
        ?.filter(isStringNode)
        .map((node) => node.String.sval)
        .filter((name): name is string => name !== undefined) || []

    if (columnNames.length > 0) {
      const constraintName =
        constraint.conname ?? `${foreignTableName}_${columnNames.join('_')}_key`
      table.constraints[constraintName] = {
        name: constraintName,
        type: 'UNIQUE',
        columnNames,
      }
    }
  }

  /**
   * Process an ALTER TABLE command
   */
  function processAlterTableCommand(cmd: Node, foreignTableName: string): void {
    if (!('AlterTableCmd' in cmd)) return

    const alterTableCmd = cmd.AlterTableCmd

    if (alterTableCmd.subtype !== 'AT_AddConstraint')
      // Only process ADD CONSTRAINT commands
      return

    const constraint = alterTableCmd.def
    if (!constraint || !isConstraintNode(constraint)) return

    if (constraint.Constraint.contype === 'CONSTR_FOREIGN') {
      processForeignKeyConstraint(foreignTableName, constraint.Constraint)
    } else if (constraint.Constraint.contype === 'CONSTR_CHECK') {
      processCheckConstraint(foreignTableName, constraint.Constraint)
    } else if (constraint.Constraint.contype === 'CONSTR_PRIMARY') {
      processPrimaryKeyConstraint(foreignTableName, constraint.Constraint)
    } else if (constraint.Constraint.contype === 'CONSTR_UNIQUE') {
      processUniqueConstraint(foreignTableName, constraint.Constraint)
    }
  }

  /**
   * Handles a CREATE TYPE AS ENUM statement by extracting the enum name and values,
   * and adding the enum to the enums collection. If the enum values are empty,
   * the enum is still created with an empty values array. If the type name is missing
   * or invalid, or if the enum name cannot be determined, the function returns early
   * and does not create the enum.
   *
   * @param createEnumStmt The CREATE TYPE AS ENUM statement node to process.
   */

  function handleCreateEnumStmt(createEnumStmt: CreateEnumStmt): void {
    // Extract type name
    if (!createEnumStmt?.typeName || createEnumStmt.typeName.length === 0)
      return

    // Extract full qualified name for schema-qualified enums
    const typeNames = createEnumStmt.typeName
      .filter(isStringNode)
      .map((n) => n.String.sval)
      .filter((name): name is string => name !== undefined)

    if (typeNames.length === 0) return

    // Join with dots first, then strip schema prefix
    const fullTypeName = typeNames.join('.')
    const enumName = stripSchemaPrefix(fullTypeName)

    // Extract enum values
    const enumValues: string[] = []
    if (createEnumStmt.vals) {
      for (const val of createEnumStmt.vals) {
        if (isStringNode(val) && val.String.sval) {
          enumValues.push(val.String.sval)
        }
      }
    }

    // Create enum even if it has empty values
    enums[enumName] = {
      name: enumName,
      values: enumValues,
      comment: null, // Will be set by COMMENT ON TYPE statements
    }
  }

  /**
   * Handle CREATE EXTENSION statement
   */
  function handleCreateExtensionStmt(
    createExtensionStmt: CreateExtensionStmt,
  ): void {
    if (!createExtensionStmt?.extname) return

    const extensionName = createExtensionStmt.extname

    const extension: Extension = {
      name: extensionName,
    }

    extensions[extensionName] = extension
  }

  /**
   * Handle ALTER TABLE statement
   */
  function handleAlterTableStmt(alterTableStmt: AlterTableStmt): void {
    // Validate required fields
    if (!alterTableStmt || !alterTableStmt.relation || !alterTableStmt.cmds)
      return

    const foreignTableName = alterTableStmt.relation.relname
    if (!foreignTableName) return

    // Process each command
    for (const cmd of alterTableStmt.cmds) {
      processAlterTableCommand(cmd, foreignTableName)
    }
  }

  // Process all statements
  for (const statement of stmts) {
    if (statement?.stmt === undefined) continue

    const stmt = statement.stmt

    if (isCreateStmt(stmt)) {
      handleCreateStmt(stmt.CreateStmt)
    } else if (isIndexStmt(stmt)) {
      handleIndexStmt(stmt.IndexStmt)
    } else if (isCommentStmt(stmt)) {
      handleCommentStmt(stmt.CommentStmt)
    } else if (isAlterTableStmt(stmt)) {
      handleAlterTableStmt(stmt.AlterTableStmt)
    } else if (isCreateEnumStmt(stmt)) {
      handleCreateEnumStmt(stmt.CreateEnumStmt)
    } else if (isCreateExtensionStmt(stmt)) {
      handleCreateExtensionStmt(stmt.CreateExtensionStmt)
    }
  }

  return {
    value: {
      tables,
      enums,
      extensions,
    },
    errors,
    unparsed,
  }
}
