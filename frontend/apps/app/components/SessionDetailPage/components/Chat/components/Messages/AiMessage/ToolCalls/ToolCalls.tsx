'use client'

import type { ToolMessage as ToolMessageType } from '@langchain/core/messages'
import type { ToolCall } from '@liam-hq/agent/client'
import type { FC } from 'react'
import type { OutputTabValue } from '../../../../../Output/constants'
import { ToolCallCard } from './ToolCallCard'
import styles from './ToolCalls.module.css'

type ToolCallAndResult = {
  call: ToolCall
  result?: ToolMessageType
}

type Props = {
  toolCallAndResults: ToolCallAndResult[]
  onNavigate: (tab: OutputTabValue) => void
}

export const ToolCalls: FC<Props> = ({ toolCallAndResults, onNavigate }) => {
  return (
    <div className={styles.container}>
      {toolCallAndResults.map(({ call, result }) => (
        <ToolCallCard
          key={call.id}
          call={call}
          result={result}
          onNavigate={onNavigate}
        />
      ))}
    </div>
  )
}
