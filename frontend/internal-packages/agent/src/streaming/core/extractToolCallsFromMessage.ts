import {
  type AIMessage,
  type AIMessageChunk,
  isAIMessage,
  isAIMessageChunk,
  isBaseMessageChunk,
} from '@langchain/core/messages'
import * as v from 'valibot'
import { type ToolCalls, toolCallsSchema } from './toolCallTypes'

export const extractToolCallsFromMessage = (
  message: AIMessage | AIMessageChunk,
): ToolCalls => {
  if (isBaseMessageChunk(message) && isAIMessageChunk(message)) {
    const parsed = v.safeParse(toolCallsSchema, message.tool_call_chunks)
    if (!parsed.success || parsed.output === undefined) {
      return []
    }
    return parsed.output
  }

  if (isAIMessage(message)) {
    const parsed = v.safeParse(toolCallsSchema, message.tool_calls)
    if (!parsed.success || parsed.output === undefined) return []
    return parsed.output
  }

  return []
}
