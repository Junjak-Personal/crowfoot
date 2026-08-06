import type { RawStmt } from '@pgsql/types'
// pg-query-emscripten does not have types, so we need to define them ourselves
// @ts-expect-error
import Module from 'pg-query-emscripten'

// pg_dump 16.10+ emits meta-commands like "\restrict"/"\unrestrict" that
// are not valid SQL. We blank them out with spaces (instead of deleting them)
// so downstream byte offsets reported by the parser remain unchanged.
export const sanitizePgDumpMetaCommands = (sql: string): string =>
  sql
    .split('\n')
    .map((line) => {
      if (!line.startsWith('\\restrict') && !line.startsWith('\\unrestrict')) {
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
