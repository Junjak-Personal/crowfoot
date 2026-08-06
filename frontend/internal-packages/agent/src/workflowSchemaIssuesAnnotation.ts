import { Annotation } from '@langchain/langgraph'

export type SchemaIssue = {
  testcaseId: string
  description: string
}

/**
 * Schema issues annotation for workflow-level state management.
 *
 * Uses a replacement reducer instead of concat because:
 * - Workflow needs to clear issues after DB agent processing
 * - Setting schemaIssues: [] should actually clear the array
 * - With concat reducer, [] would be concatenated (prev.concat([]) = prev)
 *
 * This is different from QA agent's annotation which uses concat
 * for parallel issue collection.
 */
export const workflowSchemaIssuesAnnotation = Annotation<Array<SchemaIssue>>({
  reducer: (prev, next) => next ?? prev,
  default: () => [],
})
