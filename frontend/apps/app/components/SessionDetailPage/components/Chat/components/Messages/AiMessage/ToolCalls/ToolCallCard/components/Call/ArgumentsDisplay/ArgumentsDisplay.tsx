'use client'

import {
  type FC,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import styles from './ArgumentsDisplay.module.css'
import { SyntaxHighlightedLine } from './SyntaxHighlightedLine'
import { formatArguments } from './utils/formatArguments'

type Props = {
  args: unknown
  isExpanded: boolean
}

export const ArgumentsDisplay: FC<Props> = ({ args, isExpanded }) => {
  const displayLines = useMemo(() => formatArguments(args), [args])

  const containerRef = useRef<HTMLDivElement>(null)
  const [showTopGradient, setShowTopGradient] = useState(false)
  const [showBottomGradient, setShowBottomGradient] = useState(false)

  const updateGradients = () => {
    const el = containerRef.current
    if (!el) return
    const { scrollTop, scrollHeight, clientHeight } = el
    const scrollable = scrollHeight > clientHeight + 1
    if (!scrollable) {
      setShowTopGradient(false)
      setShowBottomGradient(false)
      return
    }
    setShowTopGradient(scrollTop > 4)
    setShowBottomGradient(scrollTop < scrollHeight - clientHeight - 4)
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: Limit deps to isExpanded/displayLines; updateGradients reads refs; adding it is needless.
  useLayoutEffect(() => {
    updateGradients()
  }, [isExpanded, displayLines])

  // biome-ignore lint/correctness/useExhaustiveDependencies: Add scroll listener once; handler reads ref; re-adding is unnecessary.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handler = () => updateGradients()
    el.addEventListener('scroll', handler)
    queueMicrotask(handler)
    return () => el.removeEventListener('scroll', handler)
  }, [])

  return (
    <div className={styles.wrapper} data-expanded={isExpanded}>
      {showTopGradient && <div className={styles.gradientTop} />}
      {showBottomGradient && <div className={styles.gradientBottom} />}
      <div className={styles.container} ref={containerRef}>
        {displayLines.map((line, index) => (
          <SyntaxHighlightedLine key={`${index}-${line}`} line={line} />
        ))}
      </div>
    </div>
  )
}
