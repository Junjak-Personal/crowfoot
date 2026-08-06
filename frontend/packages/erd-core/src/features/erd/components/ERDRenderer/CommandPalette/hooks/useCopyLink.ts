import type { ToastPosition } from '@crowfoot/ui'
import { useCopy } from '@crowfoot/ui/hooks'
import { useCallback } from 'react'

export const useCopyLink = (position?: ToastPosition) => {
  const { copy } = useCopy({
    toast: {
      success: 'Link copied!',
      error: 'URL copy failed',
      position,
    },
  })

  const copyLink = useCallback(() => {
    const url = window.location.href
    copy(url)
  }, [copy])

  return { copyLink }
}
