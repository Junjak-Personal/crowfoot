// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import type { Rect } from '@xyflow/react'

/** Breathing room around the diagram, in flow units. */
const PADDING = 40

/**
 * Twice the CSS size — enough that text is crisp when the image is dropped into
 * a document, without quadrupling the file for no visible gain.
 */
const PIXEL_RATIO = 2

/**
 * Canvas ceilings, in raster pixels. Browsers cap both the longest side and the
 * total area, and going over either leaves the canvas unusable rather than
 * throwing — the export just never finishes.
 *
 * Both limits are needed, not one. Clamping the long side alone punishes a tall
 * narrow diagram twice: a 4,043 × 17,598 schema came out at 0.47x, small enough
 * that the column names were unreadable, when the area it covers was never the
 * problem.
 *
 * iOS stops at 4,096 a side, far below this. Sizing for it would make every
 * desktop export soft, so the deadline in `captureDiagram` is what turns that
 * case into a message instead.
 */
const MAX_SIDE = 16_384
const MAX_AREA = 40_000_000

export type ImageFrame = {
  /** CSS pixels. Multiply by `scale` for the raster's real size. */
  width: number
  height: number
  /**
   * The transform the captured copy of the viewport is given, positioning the
   * chosen region at the image's origin.
   *
   * Always set, never inherited. Leaving the viewport's own transform in place
   * looks like it should reproduce the screen and does not: the element is a
   * zero-size box at the pane's corner, so the rasteriser has nothing to line
   * the region up against and the diagram lands off to one side.
   */
  transform: string
  scale: number
}

const scaleFor = (width: number, height: number): number =>
  Math.min(
    PIXEL_RATIO,
    MAX_SIDE / Math.max(width, height),
    Math.sqrt(MAX_AREA / (width * height)),
  )

/** Whether there is anything to draw. Nodes that never measured have none. */
export const isEmptyBounds = (bounds: Rect): boolean =>
  !(bounds.width > 0 && bounds.height > 0)

/**
 * Frames a region of the canvas — the whole diagram, or just what is selected.
 * The viewport is moved so `bounds` sits at the origin behind `PADDING`, and
 * the image is exactly big enough to hold it.
 */
export const frameForBounds = (bounds: Rect): ImageFrame => {
  const width = Math.ceil(bounds.width + PADDING * 2)
  const height = Math.ceil(bounds.height + PADDING * 2)

  return {
    width,
    height,
    transform: `translate(${PADDING - bounds.x}px, ${PADDING - bounds.y}px)`,
    scale: scaleFor(width, height),
  }
}

/**
 * Frames what is on screen: the pane's size, and the pan and zoom the user
 * currently has, restated rather than inherited.
 */
export const frameForPane = (
  pane: { width: number; height: number },
  viewport: { x: number; y: number; zoom: number },
): ImageFrame => ({
  width: Math.round(pane.width),
  height: Math.round(pane.height),
  transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
  scale: scaleFor(pane.width, pane.height),
})
