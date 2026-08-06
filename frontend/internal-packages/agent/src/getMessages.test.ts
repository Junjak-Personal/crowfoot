import { AIMessage, HumanMessage } from '@langchain/core/messages'
import type { StateSnapshot } from '@langchain/langgraph'
import { describe, expect, it } from 'vitest'
import {
  collectMessagesFromTasks,
  extractMessagesFromState,
  mergeMessages,
} from './getMessages'

const createMockStateSnapshot = (
  values: StateSnapshot['values'],
  tasks: StateSnapshot['tasks'] = [],
): StateSnapshot => ({
  values,
  next: [],
  tasks,
  metadata: {
    source: 'input',
    step: 0,
    parents: {},
  },
  createdAt: '2024-01-01T00:00:00.000Z',
  parentConfig: undefined,
  config: { configurable: { thread_id: 'test' } },
})

const createMockTask = (
  state: StateSnapshot,
): StateSnapshot['tasks'][number] => ({
  state,
  id: `task-${Math.random()}`,
  name: 'test-task',
  interrupts: [],
})

describe('getMessages', () => {
  describe('extractMessagesFromState', () => {
    it('should extract messages from state with valid messages array', () => {
      const messages = [new HumanMessage('Hello'), new AIMessage('Hi there')]
      const state = createMockStateSnapshot({ messages })

      const result = extractMessagesFromState(state)

      expect(result).toHaveLength(2)
      expect(result[0]).toBeInstanceOf(HumanMessage)
      expect(result[1]).toBeInstanceOf(AIMessage)
      expect(result[0]?.content).toBe('Hello')
      expect(result[1]?.content).toBe('Hi there')
    })

    it('should return empty array when state.values is undefined', () => {
      const state = createMockStateSnapshot(undefined)

      const result = extractMessagesFromState(state)

      expect(result).toEqual([])
    })

    it('should handle empty messages array', () => {
      const state = createMockStateSnapshot({ messages: [] })

      const result = extractMessagesFromState(state)

      expect(result).toEqual([])
    })
  })

  describe('collectMessagesFromTasks', () => {
    it('should collect messages from tasks with child state', () => {
      const childState = createMockStateSnapshot({
        messages: [new HumanMessage('Child message')],
      })

      const state = createMockStateSnapshot({}, [createMockTask(childState)])

      const result = collectMessagesFromTasks(state)

      expect(result).toHaveLength(1)
      expect(result[0]).toBeInstanceOf(HumanMessage)
      expect(result[0]?.content).toBe('Child message')
    })

    it('should recursively collect messages from nested tasks', () => {
      const nestedChildState = createMockStateSnapshot({
        messages: [new AIMessage('Nested child message')],
      })

      const childState = createMockStateSnapshot(
        {
          messages: [new HumanMessage('Child message')],
        },
        [createMockTask(nestedChildState)],
      )

      const state = createMockStateSnapshot({}, [createMockTask(childState)])

      const result = collectMessagesFromTasks(state)

      expect(result).toHaveLength(2)
      expect(result[0]).toBeInstanceOf(HumanMessage)
      expect(result[0]?.content).toBe('Child message')
      expect(result[1]).toBeInstanceOf(AIMessage)
      expect(result[1]?.content).toBe('Nested child message')
    })

    it('should handle tasks with undefined values property', () => {
      const childState = createMockStateSnapshot(undefined)

      const state = createMockStateSnapshot({}, [createMockTask(childState)])

      const result = collectMessagesFromTasks(state)

      expect(result).toEqual([])
    })

    it('should handle empty tasks array', () => {
      const state = createMockStateSnapshot({}, [])

      const result = collectMessagesFromTasks(state)

      expect(result).toEqual([])
    })

    it('should collect messages from multiple tasks', () => {
      const childState1 = createMockStateSnapshot({
        messages: [new HumanMessage('Message from task 1')],
      })

      const childState2 = createMockStateSnapshot({
        messages: [new AIMessage('Message from task 2')],
      })

      const state = createMockStateSnapshot({}, [
        createMockTask(childState1),
        createMockTask(childState2),
      ])

      const result = collectMessagesFromTasks(state)

      expect(result).toHaveLength(2)
      expect(result[0]?.content).toBe('Message from task 1')
      expect(result[1]?.content).toBe('Message from task 2')
    })
  })

  describe('mergeMessages', () => {
    it('should merge messages from multiple groups without duplicates', () => {
      const message1 = new HumanMessage({ content: 'Hello', id: 'msg1' })
      const message2 = new AIMessage({ content: 'Hi', id: 'msg2' })
      const message3 = new HumanMessage({ content: 'How are you?', id: 'msg3' })

      const group1 = [message1, message2]
      const group2 = [message2, message3]

      const result = mergeMessages(group1, group2)

      expect(result).toHaveLength(3)
      expect(result[0]?.id).toBe('msg1')
      expect(result[1]?.id).toBe('msg2')
      expect(result[2]?.id).toBe('msg3')
    })

    it('should handle messages without IDs', () => {
      const message1 = new HumanMessage('Message without ID 1')
      const message2 = new HumanMessage('Message without ID 2')
      const message3 = new HumanMessage('Message without ID 3')

      const group1 = [message1, message2]
      const group2 = [message3]

      const result = mergeMessages(group1, group2)

      expect(result).toHaveLength(3)
    })

    it('should handle empty groups', () => {
      const message1 = new HumanMessage('Message')

      const result = mergeMessages([], [message1], [])

      expect(result).toHaveLength(1)
      expect(result[0]?.content).toBe('Message')
    })

    it('should handle duplicate IDs appearing later in same group', () => {
      const message1 = new HumanMessage({ content: 'First', id: 'msg1' })
      const message2 = new HumanMessage({ content: 'Duplicate', id: 'msg1' })

      const result = mergeMessages([message1, message2])

      expect(result).toHaveLength(1)
      expect(result[0]?.content).toBe('First')
    })

    it('should handle multiple groups with overlapping messages', () => {
      const message1 = new HumanMessage({ content: 'A', id: 'msg1' })
      const message2 = new AIMessage({ content: 'B', id: 'msg2' })
      const message3 = new HumanMessage({ content: 'C', id: 'msg3' })

      const group1 = [message1, message2]
      const group2 = [message2, message3]
      const group3 = [message1, message3]

      const result = mergeMessages(group1, group2, group3)

      expect(result).toHaveLength(3)
      expect(result[0]?.content).toBe('A')
      expect(result[1]?.content).toBe('B')
      expect(result[2]?.content).toBe('C')
    })
  })
})
