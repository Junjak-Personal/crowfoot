// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import { useEffect } from 'react'
import { useApplyUrlState } from './useApplyUrlState'

/**
 * Puts the diagram back to whatever the URL now says, after the back or
 * forward button moved it.
 *
 * Straight from the event, with no flag and no waiting for a render: the
 * address bar is already correct when a `popstate` handler runs, and
 * `useApplyUrlState` reads it directly. Gating on a re-render instead meant
 * rebuilding from the state being navigated away from, which looked exactly
 * like the back button doing nothing.
 *
 * This used to run the automatic layout and `fitView` here. Both are wrong for
 * an undo: pressing back should put back what was there, not rearrange the
 * diagram and move the camera.
 */
export const useQueryParamsChanged = () => {
  const applyUrlState = useApplyUrlState()

  useEffect(() => {
    window.addEventListener('popstate', applyUrlState)
    return () => window.removeEventListener('popstate', applyUrlState)
  }, [applyUrlState])
}
