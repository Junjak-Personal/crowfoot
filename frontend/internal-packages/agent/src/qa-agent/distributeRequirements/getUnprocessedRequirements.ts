import type { QaAgentState } from '../shared/qaAgentAnnotation'
import type { TestCaseData } from './types'

/**
 * Prepare all testcases that need SQL generation
 */
function prepareTestcases(state: QaAgentState): TestCaseData[] {
  const { analyzedRequirements } = state
  const allTestcases: TestCaseData[] = []

  // Process all testcases
  for (const [category, testcases] of Object.entries(
    analyzedRequirements.testcases,
  )) {
    for (const testcase of testcases) {
      // Only include testcases that don't have SQL yet
      if (!testcase.sql || testcase.sql === '') {
        allTestcases.push({
          category,
          testcase,
        })
      }
    }
  }

  return allTestcases
}

/**
 * Get unprocessed testcases (those without SQL)
 */
export function getUnprocessedRequirements(
  state: QaAgentState,
): TestCaseData[] {
  return prepareTestcases(state)
}
