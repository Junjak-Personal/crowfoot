import { useCallback, useEffect, useRef } from 'react'

export const useScrollToBottom = <T extends HTMLElement>(
  itemsLength: number,
) => {
  const containerRef = useRef<T | null>(null)
  const didInitialScrollRef = useRef(false)

  const scrollToBottom = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [])

  useEffect(() => {
    if (didInitialScrollRef.current) return
    if (itemsLength <= 0) return
    didInitialScrollRef.current = true
    scrollToBottom()
  }, [itemsLength, scrollToBottom])

  return { containerRef, scrollToBottom }
}
