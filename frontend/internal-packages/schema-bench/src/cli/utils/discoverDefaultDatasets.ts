import { existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Discover default datasets. Current policy: return ['default'] if it exists.
 */
export const discoverDefaultDatasets = (workspacePath: string): string[] => {
  const name = 'default'
  return existsSync(join(workspacePath, name)) ? [name] : []
}
