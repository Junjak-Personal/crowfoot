#!/usr/bin/env node

// path resolution handled in utils
import { processDataset } from './executeLiamDbShared'
import {
  filterAndResolveDatasets,
  getWorkspacePath,
  handleCliError,
  handleUnexpectedError,
  parseArgs,
  selectTargetDatasets,
} from './utils'

type DatasetResult = { datasetName: string; success: number; failure: number }

const runDatasets = async (
  datasets: Array<{ name: string; path: string }>,
): Promise<DatasetResult[]> => {
  const results: DatasetResult[] = []
  for (const { name, path } of datasets) {
    const result = await processDataset(name, path)
    results.push(result)
  }
  return results
}

const summarizeAndAssert = (results: DatasetResult[]): void => {
  if (results.length === 0) {
    handleCliError('No datasets were processed (all were missing or invalid).')
  }
  const totalSuccess = results.reduce((sum, r) => sum + r.success, 0)
  const totalFailure = results.reduce((sum, r) => sum + r.failure, 0)
  if (totalSuccess === 0 && totalFailure === 0) {
    handleCliError('No cases were processed across selected datasets')
  }
  if (totalFailure > 0) {
    handleCliError(`${totalFailure} case(s) failed across selected datasets`)
  }
}

async function main() {
  const options = parseArgs(process.argv)
  const workspacePath = getWorkspacePath()
  const targetDatasets = selectTargetDatasets(options, workspacePath)
  if (targetDatasets.length === 0) {
    handleCliError('No datasets found to process')
  }
  const validDatasets = filterAndResolveDatasets(targetDatasets, workspacePath)
  const results = await runDatasets(validDatasets)
  summarizeAndAssert(results)
}

main().catch(handleUnexpectedError)
