// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import { useStore } from '@xyflow/react'
import type { ShowMode } from '../../../../schemas'
import { useUserEditingOrThrow } from '../../../../stores'
import { NAME_ONLY_ZOOM } from '../../../reactflow/constants'

/**
 * What a table should draw, once the zoom level has had its say.
 *
 * Zoomed out past `NAME_ONLY_ZOOM` the canvas falls back to names only — the
 * same shape the `Table Name` show mode draws, handles included, so the edges
 * still land somewhere. Nothing is stored: `?show=`, the toolbar and the back
 * button are untouched, and zooming in puts the columns back.
 *
 * An explicit `override` wins outright. Those come from the previews — the
 * command palette's and the related-tables pane's — which share the main
 * canvas's store and would otherwise collapse along with it.
 */
export const useShowMode = (override: ShowMode | undefined): ShowMode => {
  const { showMode } = useUserEditingOrThrow()
  // A boolean rather than the zoom itself: a table re-renders when the
  // threshold is crossed, not on every frame of the gesture.
  const nameOnly = useStore((store) => store.transform[2] < NAME_ONLY_ZOOM)

  if (override !== undefined) return override

  return nameOnly ? 'TABLE_NAME' : showMode
}
