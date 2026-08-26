export {
  detectFormat,
  ProcessError,
  parse,
  type SupportedFormat,
  setPrismWasmUrl,
  supportedFormatSchema,
  type Unparsed,
} from './parser/index.js'

// Export PostgreSQL-specific parser
export {
  type PgParseResult,
  parse as pgParse,
} from './parser/sql/postgresql/parser.js'
