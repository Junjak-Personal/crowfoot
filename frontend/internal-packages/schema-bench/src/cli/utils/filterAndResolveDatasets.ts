import { existsSync } from 'node:fs'
import { isAbsolute, relative, resolve } from 'node:path'

type ResolvedDataset = { name: string; path: string }

/**
 * From a list of dataset names, resolve absolute paths under the workspace,
 * skip invalid or missing paths, and return name/path pairs.
 */
export const filterAndResolveDatasets = (
  targetDatasets: string[],
  workspacePath: string,
): ResolvedDataset[] => {
  const resolvedWorkspace = resolve(workspacePath)
  const resolved: ResolvedDataset[] = []
  for (const name of targetDatasets) {
    const datasetPath = resolve(workspacePath, name)
    const rel = relative(resolvedWorkspace, datasetPath)
    if (rel.startsWith('..') || isAbsolute(rel)) {
      console.warn(`   ⚠️  Skipping invalid dataset path: ${name}`)
      continue
    }
    if (!existsSync(datasetPath)) {
      // Silently skip missing datasets to mirror existing behavior
      continue
    }
    resolved.push({ name, path: datasetPath })
  }
  return resolved
}
