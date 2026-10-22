import type { RawStmt } from '@pgsql/types'
// pg-query-emscripten does not have types, so we need to define them ourselves
// @ts-expect-error
import Module from 'pg-query-emscripten'

/**
 * Blanks psql's own directives, which are not SQL and which the parser rejects.
 *
 * Any line whose first character is a backslash: pg_dump 16.10+ writes
 * `\restrict`/`\unrestrict`, and a migration meant to be run through psql
 * often opens with `\set ON_ERROR_STOP on`. None of them end in a semicolon,
 * so a line left in place does not merely fail on its own — it runs into the
 * statement below and takes that down with it.
 *
 * Blanked with spaces rather than deleted so every offset the parser reports
 * still lines up with the original text.
 */
export const sanitizePgDumpMetaCommands = (sql: string): string =>
  sql
    .split('\n')
    .map((line) => {
      if (!line.startsWith('\\')) {
        return line
      }

      const endsWithCarriageReturn = line.endsWith('\r')
      const contentLength = endsWithCarriageReturn
        ? line.length - 1
        : line.length
      const padding = ' '.repeat(contentLength)

      return endsWithCarriageReturn ? `${padding}\r` : padding
    })
    .join('\n')

export const parse = async (str: string): Promise<PgParseResult> => {
  // Sanitize \restrict and \unrestrict meta-commands emitted by pg_dump 16.10+
  // by replacing their contents with spaces while preserving byte offsets.
  const sanitizedStr = sanitizePgDumpMetaCommands(str)

  const pgQuery = await new Module({
    wasmMemory: new WebAssembly.Memory({
      initial: 2048, // 128MB (64KB × 2048 pages)
      maximum: 4096, // 256MB max
    }),
  })
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const result = pgQuery.parse(sanitizedStr)
  return result
}

// NOTE: pg-query-emscripten does not have types, so we need to define them ourselves
export type PgParseResult = {
  parse_tree: {
    version: number
    stmts: RawStmt[]
  }
  stderr_buffer: string
  error: {
    message: string
    funcname: string
    filename: string
    lineno: number
    cursorpos: number
    context: string
  } | null
}
