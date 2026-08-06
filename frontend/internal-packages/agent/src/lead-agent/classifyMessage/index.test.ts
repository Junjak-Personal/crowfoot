import { END } from '@langchain/langgraph'
import { describe, expect, it } from 'vitest'
import type { WorkflowState } from '../../types'
import { classifyMessage } from './index'

const createMockState = (
  overrides: Partial<WorkflowState> = {},
): WorkflowState => ({
  messages: [],
  analyzedRequirements: {
    goal: '',
    testcases: {},
  },
  schemaIssues: [],
  schemaData: { tables: {}, enums: {}, extensions: {} },
  organizationId: 'test-org-id',
  userId: 'test-user-id',
  designSessionId: 'test-session-id',
  next: END,
  ...overrides,
})

describe('classifyMessage', () => {
  it('should route to dbAgent when schema issues exist', async () => {
    const state = createMockState({
      schemaIssues: [
        {
          testcaseId: 'test-1',
          description: 'Missing foreign key constraint',
        },
      ],
    })

    const result = await classifyMessage(state)

    expect(result.goto).toEqual([END])
    expect(result.update).toEqual({ next: 'dbAgent' })
  })

  it('should route to dbAgent when multiple schema issues exist', async () => {
    const state = createMockState({
      schemaIssues: [
        {
          testcaseId: 'test-1',
          description: 'Missing foreign key constraint',
        },
        { testcaseId: 'test-2', description: 'Invalid table name' },
      ],
    })

    const result = await classifyMessage(state)

    expect(result.goto).toEqual([END])
    expect(result.update).toEqual({ next: 'dbAgent' })
  })

  it('should prioritize schema issues over QA completion', async () => {
    const state = createMockState({
      schemaIssues: [
        { testcaseId: 'test-1', description: 'Schema issue found' },
      ],
      analyzedRequirements: {
        goal: 'Test goal',
        testcases: {
          functional: [
            {
              id: 'test-1',
              title: 'Test case',
              type: 'SELECT',
              sql: 'SELECT 1',
              testResults: [],
            },
          ],
        },
      },
    })

    const result = await classifyMessage(state)

    expect(result.goto).toEqual([END])
    expect(result.update).toEqual({ next: 'dbAgent' })
  })

  it('should route to summarizeWorkflow when QA completed and no schema issues', async () => {
    const state = createMockState({
      schemaIssues: [],
      analyzedRequirements: {
        goal: 'Test goal',
        testcases: {
          functional: [
            {
              id: 'test-1',
              title: 'Test case',
              type: 'SELECT',
              sql: 'SELECT 1',
              testResults: [],
            },
          ],
        },
      },
    })

    const result = await classifyMessage(state)

    expect(result.goto).toEqual(['summarizeWorkflow'])
    expect(result.update).toBeUndefined()
  })

  it('should route to pmAgent when no schema issues and QA not completed', async () => {
    const state = createMockState({
      schemaIssues: [],
      analyzedRequirements: {
        goal: 'Test goal',
        testcases: {},
      },
    })

    const result = await classifyMessage(state)

    expect(result.goto).toEqual([END])
    expect(result.update).toEqual({ next: 'pmAgent' })
  })
})
