import {
  type BaseMessage,
  isAIMessage,
  isHumanMessage,
  isToolMessage,
} from '@langchain/core/messages'
import type { FC } from 'react'
import type { OutputTabValue } from '../../../Output/constants'
import { AiMessage } from './AiMessage'
import { HumanMessage } from './HumanMessage'

type Props = {
  messages: BaseMessage[]
  onNavigate: (tab: OutputTabValue) => void
  isWorkflowRunning?: boolean
}

export const Messages: FC<Props> = ({
  messages,
  onNavigate,
  isWorkflowRunning = false,
}) => {
  const toolMessages = messages.filter((msg) => isToolMessage(msg))

  return messages.map((message, _index) => {
    if (isAIMessage(message)) {
      return (
        <AiMessage
          key={message.id}
          message={message}
          toolMessages={toolMessages}
          onNavigate={onNavigate}
          isWorkflowRunning={isWorkflowRunning}
        />
      )
    }

    if (isHumanMessage(message)) {
      return <HumanMessage key={message.id} message={message} />
    }

    // Skip rendering ToolMessages as they're handled with their corresponding AIMessage
    if (isToolMessage(message)) {
      return null
    }

    return null
  })
}
