// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.

/** One statement, and where it starts in the input it came from. */
export type SqlStatement = {
  text: string
  /** Character index into the original SQL, not a byte offset. */
  start: number
}

const DOLLAR_TAG = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/

/**
 * What can appear inside a name. `$` is one of them, which is why a dollar
 * quote only opens where a name is not already being spelled.
 */
const IDENTIFIER_CHAR = /[A-Za-z0-9_$]/

/** The index just past the single-quoted string starting at `i`. */
const endOfString = (sql: string, i: number, escapes: boolean): number => {
  for (let j = i + 1; j < sql.length; j++) {
    if (escapes && sql[j] === '\\') {
      j++
      continue
    }
    if (sql[j] !== "'") continue
    // '' is an escaped quote, not the end.
    if (sql[j + 1] === "'") j++
    else return j + 1
  }

  return sql.length
}

/** The index just past the double-quoted identifier starting at `i`. */
const endOfIdentifier = (sql: string, i: number): number => {
  for (let j = i + 1; j < sql.length; j++) {
    if (sql[j] !== '"') continue
    if (sql[j + 1] === '"') j++
    else return j + 1
  }

  return sql.length
}

/** Postgres nests block comments, unlike C. */
const endOfBlockComment = (sql: string, i: number): number => {
  let depth = 0

  for (let j = i; j < sql.length - 1; j++) {
    if (sql[j] === '/' && sql[j + 1] === '*') {
      depth++
      j++
    } else if (sql[j] === '*' && sql[j + 1] === '/') {
      depth--
      j++
      if (depth === 0) return j + 1
    }
  }

  return sql.length
}

/**
 * The index just past the dollar-quoted body starting at `i`, or null if `i`
 * is not the start of one. The closing delimiter has to carry the same tag:
 * `$$ … $$` nested inside `$body$ … $body$` closes nothing.
 */
const endOfDollarQuote = (sql: string, i: number): number | null => {
  const open = DOLLAR_TAG.exec(sql.slice(i))
  if (open === null) return null

  const close = sql.indexOf(open[0], i + open[0].length)
  return close === -1 ? sql.length : close + open[0].length
}

/**
 * The first character that is part of a statement rather than in front of it.
 * A run that turns out to be nothing but comments and blank lines — the tail
 * of a file, usually — is not a statement.
 */
const firstMeaningful = (sql: string, from: number, to: number): number => {
  let i = from

  while (i < to) {
    if (/\s/.test(sql[i] ?? '')) {
      i++
      continue
    }

    if (sql[i] === '-' && sql[i + 1] === '-') {
      const newline = sql.indexOf('\n', i)
      i = newline === -1 || newline >= to ? to : newline + 1
      continue
    }

    if (sql[i] === '/' && sql[i + 1] === '*') {
      i = Math.min(endOfBlockComment(sql, i), to)
      continue
    }

    return i
  }

  return to
}

/**
 * The index just past whatever starts at `i` that a semicolon inside cannot
 * end — a string, a quoted identifier, either kind of comment, a dollar-quoted
 * body — or null when `i` is ordinary code.
 */
const endOfOpaque = (sql: string, i: number): number | null => {
  const char = sql[i]

  if (char === "'") {
    // Only a standalone `E` makes this an escape string. A keyword that ends
    // in one — `LIKE'x'` — does not, and reading it as one lets a trailing
    // backslash swallow the statement after it.
    const previous = sql[i - 1]
    const prefixed = previous === 'E' || previous === 'e'
    const standalone = !IDENTIFIER_CHAR.test(sql[i - 2] ?? '')

    return endOfString(sql, i, prefixed && standalone)
  }

  if (char === '"') return endOfIdentifier(sql, i)

  if (char === '-' && sql[i + 1] === '-') {
    const newline = sql.indexOf('\n', i)
    return newline === -1 ? sql.length : newline
  }

  if (char === '/' && sql[i + 1] === '*') return endOfBlockComment(sql, i)
  // `a$b$c` is one identifier, not a name followed by a quoted body. Opening
  // a quote there runs to the end of the file.
  if (char === '$' && !IDENTIFIER_CHAR.test(sql[i - 1] ?? '')) {
    return endOfDollarQuote(sql, i)
  }

  return null
}

/**
 * Cuts SQL into statements at the semicolons that actually end one.
 *
 * This replaces reading the input in windows of N lines. That approach had no
 * idea where a statement began or ended: it handed the parser whatever fell
 * inside the window, and when a statement straddled the edge it tried
 * neighbouring window sizes until something parsed. On a large file that lost
 * statements outright — a schema of 103 tables came back with 97, or with 11,
 * depending on the window size, and said nothing either time. A statement is
 * the unit the parser accepts, so a statement is the unit to cut on.
 *
 * Everything that can hold a semicolon without ending anything is skipped
 * whole: strings, `E''` escape strings, quoted identifiers, dollar-quoted
 * bodies (which is how a function arrives, full of semicolons), and both kinds
 * of comment. An unterminated one runs to the end of the input rather than
 * throwing — the parser will say so far better than this can.
 */
export const splitStatements = (sql: string): SqlStatement[] => {
  const statements: SqlStatement[] = []
  let start = 0

  const push = (end: number): void => {
    const from = firstMeaningful(sql, start, end)
    if (from < end) statements.push({ text: sql.slice(from, end), start: from })
    start = end
  }

  for (let i = 0; i < sql.length; i++) {
    const opaque = endOfOpaque(sql, i)
    if (opaque !== null) {
      i = opaque - 1
      continue
    }

    if (sql[i] === ';') push(i + 1)
  }

  push(sql.length)

  return statements
}
