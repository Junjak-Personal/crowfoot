'use client'

import type { ToolMessage } from '@langchain/core/messages'
import type { ToolCall } from '@liam-hq/agent/client'
import { ChevronDown, Wrench } from '@liam-hq/ui'
import clsx from 'clsx'
import { type FC, useCallback, useState } from 'react'
import type { OutputTabValue } from '../../../../../../Output/constants'
import { Call, Result } from './components'
import styles from './ToolCallCard.module.css'
import { getToolDisplayInfo } from './utils/getToolDisplayInfo'

type Props = {
  call: ToolCall
  result?: ToolMessage
  onNavigate: (tab: OutputTabValue) => void
}

export const ToolCallCard: FC<Props> = ({ call, result, onNavigate }) => {
  const { displayName } = getToolDisplayInfo(call.name)
  const status = result?.status
  const displayStatus = status ?? 'running'

  const [expanded, setExpanded] = useState(status === undefined)
  const handleToggle = useCallback(() => {
    setExpanded((prev) => !prev)
  }, [])

  return (
    <div
      className={styles.container}
      data-expanded={expanded}
      data-status={displayStatus}
    >
      <button
        type="button"
        className={styles.header}
        data-expanded={expanded}
        aria-expanded={expanded}
        onClick={handleToggle}
      >
        <div className={styles.headerContent}>
          <div className={styles.headerLeft}>
            <div className={styles.iconWrapper}>
              <Wrench className={clsx(styles.icon, styles.wrench)} />
              <ChevronDown className={clsx(styles.icon, styles.chevron)} />
            </div>
            <div className={styles.titleWrapper}>
              <span className={styles.toolName}>{displayName}</span>
              {status === undefined && (
                <span className={styles.statusText}>Running...</span>
              )}
            </div>
          </div>
          <div className={styles.headerRight}>
            {status === 'error' && (
              <span className={styles.badgeError}>Error</span>
            )}
          </div>
        </div>
      </button>

      <div className={styles.contentWrapper}>
        <div className={styles.content}>
          <Call call={call} />
          <Result
            toolName={call.name}
            result={result}
            onNavigate={onNavigate}
          />
        </div>
      </div>
    </div>
  )
}
