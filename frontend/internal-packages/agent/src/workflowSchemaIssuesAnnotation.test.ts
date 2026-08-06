import { StateGraph } from '@langchain/langgraph'
import { describe, expect, it } from 'vitest'
import type { WorkflowState } from './types'
import { workflowAnnotation } from './workflowAnnotation'

describe('workflowSchemaIssuesAnnotation', () => {
  it('should replace schemaIssues (not concat)', async () => {
    const graph = new StateGraph(workflowAnnotation)
      .addNode('step1', (_state: WorkflowState) => ({
        schemaIssues: [{ testcaseId: 'test-1', description: 'Issue 1' }],
      }))
      .addNode('step2', (_state: WorkflowState) => ({
        schemaIssues: [{ testcaseId: 'test-2', description: 'Issue 2' }],
      }))
      .addEdge('__start__', 'step1')
      .addEdge('step1', 'step2')
      .addEdge('step2', '__end__')
      .compile()

    const result = await graph.invoke({
      messages: [],
      schemaData: { tables: {}, enums: {}, extensions: {} },
    })

    // Should be replaced (only step2's issue), not concatenated
    expect(result.schemaIssues).toEqual([
      { testcaseId: 'test-2', description: 'Issue 2' },
    ])
  })

  it('should clear schemaIssues when set to empty array', async () => {
    const graph = new StateGraph(workflowAnnotation)
      .addNode('step1', (_state: WorkflowState) => ({
        schemaIssues: [
          { testcaseId: 'test-1', description: 'Issue 1' },
          { testcaseId: 'test-2', description: 'Issue 2' },
        ],
      }))
      .addNode('step2', (_state: WorkflowState) => ({
        schemaIssues: [],
      }))
      .addEdge('__start__', 'step1')
      .addEdge('step1', 'step2')
      .addEdge('step2', '__end__')
      .compile()

    const result = await graph.invoke({
      messages: [],
      schemaData: { tables: {}, enums: {}, extensions: {} },
    })

    // Should be cleared
    expect(result.schemaIssues).toEqual([])
  })

  it('should keep schemaIssues when not updated', async () => {
    const graph = new StateGraph(workflowAnnotation)
      .addNode('step1', (_state: WorkflowState) => ({
        schemaIssues: [{ testcaseId: 'test-1', description: 'Issue 1' }],
      }))
      .addNode('step2', (_state: WorkflowState) => ({
        // Not updating schemaIssues
      }))
      .addEdge('__start__', 'step1')
      .addEdge('step1', 'step2')
      .addEdge('step2', '__end__')
      .compile()

    const result = await graph.invoke({
      messages: [],
      schemaData: { tables: {}, enums: {}, extensions: {} },
    })

    // Should keep step1's value
    expect(result.schemaIssues).toEqual([
      { testcaseId: 'test-1', description: 'Issue 1' },
    ])
  })
})
