export const MIN_ZOOM = 0.1
export const MAX_ZOOM = 2

/**
 * Below this the column rows are too small to read, so the canvas drops to
 * names only. Rendering only — `?show=` and the toolbar keep the viewer's
 * choice, and zooming back in restores it.
 */
export const NAME_ONLY_ZOOM = 0.5

/**
 * Below this only the group labels are left: the boxes, their member tables and
 * the edges between them all go, because at this size they are texture rather
 * than information. A table in no group stays — nothing else would speak for it.
 *
 * The third rung of the ladder. Above `NAME_ONLY_ZOOM` a table draws its
 * columns; between the two it draws its name; below this its group draws for it.
 */
export const GROUP_ONLY_ZOOM = 0.25

/**
 * The zoom whose on-screen name size is the one worth holding on to. Stated as
 * a zoom rather than a pixel size so nothing here has to know what font the
 * name is set in — `LABEL_HOLD_ZOOM / zoom` is exactly the counter-scale that
 * keeps it there.
 */
export const LABEL_HOLD_ZOOM = 0.9

/**
 * How far a name may be counter-scaled.
 *
 * ponytail: a flat cap. Past it the names shrink again rather than growing
 * their nodes into each other — a collision-aware label layout is the upgrade
 * path, and it belongs with the group-collapse option deferred alongside it.
 */
export const MAX_LABEL_SCALE = 3

/**
 * Counter-scaling is rounded to this, so a zoom gesture resizes the names a
 * handful of times instead of on every frame. Each change re-measures every
 * node it widens, which is the cost worth keeping off the gesture.
 */
export const LABEL_SCALE_STEP = 0.5
