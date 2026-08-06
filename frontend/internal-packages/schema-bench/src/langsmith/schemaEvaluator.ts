import { type Schema, schemaSchema } from '@liam-hq/schema'
import type { EvaluatorT } from 'langsmith/evaluation'
import type { Example, Run } from 'langsmith/schemas'
import * as v from 'valibot'
import { evaluate } from '../evaluate/evaluate.ts'

const validateSchema = (data: unknown): Schema => v.parse(schemaSchema, data)

const countTables = (schema: Schema): number => {
  return Object.keys(schema.tables).length
}

const countColumns = (schema: Schema): number => {
  return Object.values(schema.tables).reduce(
    (total, table) => total + Object.keys(table.columns).length,
    0,
  )
}

export const schemaEvaluator: EvaluatorT = async (args: {
  run: Run
  example: Example
  inputs: Record<string, unknown>
  outputs: Record<string, unknown>
  referenceOutputs?: Record<string, unknown>
}) => {
  const referenceSchema = validateSchema(args.referenceOutputs?.['schema'])
  const outputSchema = validateSchema(args.outputs['schema'])
  const result = await evaluate(referenceSchema, outputSchema)

  return [
    {
      key: 'Table Count',
      score: countTables(outputSchema),
    },
    {
      key: 'Column Count',
      score: countColumns(outputSchema),
    },
    {
      key: 'Table F1 Score',
      score: result.tableF1Score,
    },
    {
      key: 'Table Recall',
      score: result.tableRecall,
    },
    {
      key: 'Column F1 Score Average',
      score: result.columnF1ScoreAverage,
    },
    {
      key: 'Column Recall Average',
      score: result.columnRecallAverage,
    },
    {
      key: 'Column All Correct Rate Average',
      score: result.columnAllCorrectRateAverage,
    },
  ]
}
