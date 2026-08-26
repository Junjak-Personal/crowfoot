// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import { useStore } from '@xyflow/react'
import { GROUP_ONLY_ZOOM, NAME_ONLY_ZOOM } from '../../../reactflow/constants'

/**
 * How much of itself the canvas is drawing.
 *
 * - `none`  — everything, as it was authored.
 * - `table` — a table is its name; the columns are too small to read.
 * - `group` — a group is its label; the box, its members and their edges go.
 *
 * One rung per thing that stops being legible, in the order they stop.
 */
type LodTier = 'none' | 'table' | 'group'

/**
 * A tier, never the zoom itself: the value changes twice across the whole
 * range instead of on every frame of a gesture, so a node re-renders when it
 * has something different to draw and not before.
 */
export const useLodTier = (): LodTier =>
  useStore((store) => {
    const zoom = store.transform[2]
    if (zoom < GROUP_ONLY_ZOOM) return 'group'
    if (zoom < NAME_ONLY_ZOOM) return 'table'
    return 'none'
  })
