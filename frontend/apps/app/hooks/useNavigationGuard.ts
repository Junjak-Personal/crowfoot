import { useEffect } from 'react'

export const useNavigationGuard = (
  beforeNavigate: (event: Event) => boolean,
) => {
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (
        event.target instanceof Element &&
        event.target.closest('a:not([target="_blank"])')
      ) {
        const shouldContinue = beforeNavigate(event)
        if (!shouldContinue) {
          event.preventDefault()
          event.stopPropagation()
        }
      }
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      const shouldContinue = beforeNavigate(event)
      if (!shouldContinue) {
        event.preventDefault()
        event.returnValue = ''
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('click', handleClick, true)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('click', handleClick, true)
    }
  }, [beforeNavigate])
}
