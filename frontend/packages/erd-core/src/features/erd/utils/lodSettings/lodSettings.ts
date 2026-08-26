// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import * as v from 'valibot'
import {
  GROUP_ONLY_ZOOM,
  MAX_ZOOM,
  MIN_ZOOM,
  NAME_ONLY_ZOOM,
} from '../../../reactflow/constants'

/**
 * The zoom each rung of the detail ladder starts at.
 *
 * How dense a diagram is, and how far away the person reading it is sitting,
 * are things only they know: 23 tables and 300 tables stop being legible at
 * very different zooms. The defaults are what the constants say; this is the
 * knob for when they are wrong.
 */
export type LodSettings = {
  /** Below this a table draws its name only. */
  nameOnlyZoom: number
  /** Below this a group draws for its members. Never above `nameOnlyZoom`. */
  groupOnlyZoom: number
}

export const DEFAULT_LOD_SETTINGS: LodSettings = {
  nameOnlyZoom: NAME_ONLY_ZOOM,
  groupOnlyZoom: GROUP_ONLY_ZOOM,
}

/**
 * Not scoped to the diagram, unlike the base-document cache next door: this is
 * a statement about the reader's eyes and screen, and carrying it from one
 * diagram to the next is the point.
 */
const KEY = 'crowfoot:lod'

const zoomSchema = v.pipe(
  v.number(),
  v.minValue(MIN_ZOOM),
  v.maxValue(MAX_ZOOM),
)

const storedSchema = v.object({
  nameOnlyZoom: zoomSchema,
  groupOnlyZoom: zoomSchema,
})

/**
 * A group rung above the table rung would leave no zoom at which a table draws
 * its name, which is not a setting anyone means. The lower one gives way.
 */
export const normalizeLodSettings = (settings: LodSettings): LodSettings => {
  const parsed = v.safeParse(storedSchema, settings)
  if (!parsed.success) return DEFAULT_LOD_SETTINGS

  const { nameOnlyZoom, groupOnlyZoom } = parsed.output
  return {
    nameOnlyZoom,
    groupOnlyZoom: Math.min(groupOnlyZoom, nameOnlyZoom),
  }
}

const read = (): LodSettings => {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw === null) return DEFAULT_LOD_SETTINGS
    return normalizeLodSettings(JSON.parse(raw))
  } catch {
    // A browser that refuses storage, or a key someone edited by hand. The
    // defaults are always a working diagram.
    return DEFAULT_LOD_SETTINGS
  }
}

let current: LodSettings = read()
const listeners = new Set<() => void>()

export const getLodSettings = (): LodSettings => current

export const subscribeLodSettings = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const setLodSettings = (settings: LodSettings): void => {
  current = normalizeLodSettings(settings)

  try {
    localStorage.setItem(KEY, JSON.stringify(current))
  } catch {
    // Kept for this session either way — refusing to change the view because
    // it cannot be remembered would be the worse failure.
  }

  for (const listener of Array.from(listeners)) listener()
}

export const resetLodSettings = (): void => setLodSettings(DEFAULT_LOD_SETTINGS)
