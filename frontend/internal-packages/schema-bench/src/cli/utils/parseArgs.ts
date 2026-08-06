import { handleCliError } from './error.ts'

type CliOptions = {
  datasets?: string[]
  useAll?: boolean
}

// Allow alphanumerics, '-', '_' and length 1..64
const VALID_DATASET = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/

/**
 * Parse CLI arguments for dataset selection.
 * Supported patterns:
 *  - <command> -all
 *  - <command> -default -entity-extraction
 */
export const parseArgs = (argv: string[]): CliOptions => {
  const options: CliOptions = {}
  const args = argv.slice(2)
  for (const tok of args) {
    if (!tok || !tok.startsWith('-')) continue
    const name = tok.replace(/^-+/, '')
    if (name === 'all') {
      options.useAll = true
      continue
    }
    if (name) {
      if (!VALID_DATASET.test(name)) {
        handleCliError(
          `Invalid dataset token "${name}". Allowed: letters, numbers, "-", "_" (1–64 chars).`,
        )
      }
      options.datasets = [...(options.datasets ?? []), name]
    }
  }
  return options
}
