import type { ToolCall } from '@liam-hq/agent/client'
import {
  ArrowTooltipContent,
  ArrowTooltipPortal,
  ArrowTooltipProvider,
  ArrowTooltipRoot,
  ArrowTooltipTrigger,
  FoldVertical,
  UnfoldVertical,
} from '@liam-hq/ui'
import { type FC, useCallback, useState } from 'react'
import { ArgumentsDisplay } from './ArgumentsDisplay'
import styles from './Call.module.css'

type Props = {
  call: ToolCall
}

export const Call: FC<Props> = ({ call }) => {
  const [expanded, setExpanded] = useState(false)

  const handleToggle = useCallback(() => {
    setExpanded((prev) => !prev)
  }, [])

  return (
    <div>
      <div className={styles.header}>
        <span className={styles.title}>Arguments</span>
        <ArrowTooltipProvider>
          <ArrowTooltipRoot>
            <ArrowTooltipTrigger asChild>
              <button
                type="button"
                className={styles.button}
                aria-label={
                  expanded ? 'Collapse arguments' : 'Expand arguments'
                }
                onClick={handleToggle}
              >
                {expanded ? (
                  <FoldVertical size={14} />
                ) : (
                  <UnfoldVertical size={14} />
                )}
              </button>
            </ArrowTooltipTrigger>
            <ArrowTooltipPortal>
              <ArrowTooltipContent side="left" align="center">
                {expanded ? 'Collapse' : 'Expand'}
              </ArrowTooltipContent>
            </ArrowTooltipPortal>
          </ArrowTooltipRoot>
        </ArrowTooltipProvider>
      </div>
      <ArgumentsDisplay args={call.args} isExpanded={expanded} />
    </div>
  )
}
