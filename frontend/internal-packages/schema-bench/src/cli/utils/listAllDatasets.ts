import { readdirSync } from 'node:fs'

/**
 * List all dataset directory names under the given workspace path.
 * Returns an empty array if the directory cannot be read.
 */
export const listAllDatasets = (workspacePath: string): string[] => {
  try {
    const entries = readdirSync(workspacePath, { withFileTypes: true })
    return entries.filter((e) => e.isDirectory()).map((e) => e.name)
  } catch {
    return []
  }
}
