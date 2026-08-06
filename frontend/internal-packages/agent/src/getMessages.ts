import { type BaseMessage, isBaseMessage } from '@langchain/core/messages'
import type {
  LangGraphRunnableConfig,
  StateSnapshot,
} from '@langchain/langgraph'
import { createGraph } from './createGraph'
import type { WorkflowConfigurable } from './types'

export function extractMessagesFromState(state: StateSnapshot): BaseMessage[] {
  const { values } = state
  if (!values) {
    return []
  }

  if (!('messages' in values)) {
    return []
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const rawMessages = values.messages
  if (!Array.isArray(rawMessages)) {
    return []
  }

  const messages: BaseMessage[] = []
  for (const item of rawMessages) {
    if (isBaseMessage(item)) {
      messages.push(item)
    }
  }

  return messages
}

function isStateSnapshot(
  value: LangGraphRunnableConfig | StateSnapshot,
): value is StateSnapshot {
  if (!value || typeof value !== 'object') return false
  // LangGraphRunnableConfig lacks these fields, while StateSnapshot has them.
  return 'values' in value && 'tasks' in value
}

export function collectMessagesFromTasks(state: StateSnapshot): BaseMessage[] {
  const collected: BaseMessage[] = []

  const { tasks } = state
  if (!Array.isArray(tasks)) return collected

  for (const task of tasks) {
    const childState = task.state
    if (!childState) continue

    if (isStateSnapshot(childState)) {
      collected.push(...extractMessagesFromState(childState))
      // Recursively collect messages from child tasks
      collected.push(...collectMessagesFromTasks(childState))
    }
  }

  return collected
}

export function mergeMessages(...groups: BaseMessage[][]): BaseMessage[] {
  const merged: BaseMessage[] = []
  const seenIds = new Set<string>()

  for (const group of groups) {
    for (const message of group) {
      const identifier = message.id
      if (identifier) {
        if (seenIds.has(identifier)) {
          continue
        }
        seenIds.add(identifier)
      }

      merged.push(message)
    }
  }

  return merged
}

export async function getMessages(config: {
  configurable: WorkflowConfigurable
}): Promise<BaseMessage[]> {
  const graph = createGraph(
    config.configurable.repositories.schema.checkpointer,
  )
  const state: StateSnapshot = await graph.getState(
    { ...config },
    { subgraphs: true },
  )

  const stateMessages = extractMessagesFromState(state)
  const taskMessages = collectMessagesFromTasks(state)

  return mergeMessages(stateMessages, taskMessages)
}
