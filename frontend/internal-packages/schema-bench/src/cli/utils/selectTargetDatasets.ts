import { discoverDefaultDatasets } from './discoverDefaultDatasets'
import { listAllDatasets } from './listAllDatasets'

type SelectOptions = {
  datasets?: string[]
  useAll?: boolean
}

/**
 * Decide which dataset names to target based on CLI-style options
 * and the datasets present under the workspace path.
 */
export const selectTargetDatasets = (
  options: SelectOptions,
  workspacePath: string,
): string[] => {
  let targets: string[] = []
  if (options.useAll) {
    targets = listAllDatasets(workspacePath)
  } else if (!options.datasets || options.datasets.length === 0) {
    targets = discoverDefaultDatasets(workspacePath)
  }
  if (options.datasets && options.datasets.length > 0) {
    // Merge while preserving order and deduplicating
    targets = [...new Set([...targets, ...options.datasets])]
  }
  return targets
}
