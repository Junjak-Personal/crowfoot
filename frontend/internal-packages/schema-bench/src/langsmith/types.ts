import type { Schema } from '@liam-hq/schema'

export type LangSmithInput = {
  prompt?: string
  input?: string
}

export type LangSmithOutput = {
  schema: Schema
}

export type LangSmithDatasetConfig = {
  datasetName: string
  workspacePath: string
}
