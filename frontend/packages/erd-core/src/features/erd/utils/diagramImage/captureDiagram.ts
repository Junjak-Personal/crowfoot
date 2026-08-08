// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import type { ImageFrame } from './frame'

/**
 * The layer holding the nodes. Capturing this rather than the whole pane is
 * what leaves the zoom controls, the show-mode bar and React Flow's own badge
 * out of the picture — they are siblings of it, not children.
 */
const VIEWPORT_SELECTOR = '.react-flow__viewport'

/**
 * Long enough for a cold font fetch on a slow connection, short enough that a
 * blocked one does not look like a hang. Past it the export goes ahead with
 * whatever it has — see `captureDiagram`.
 */
const FETCH_TIMEOUT_MS = 5000

export const findViewport = (root: ParentNode = document): HTMLElement | null =>
  root.querySelector<HTMLElement>(VIEWPORT_SELECTOR)

/** Past this the export is treated as failed rather than merely slow. */
const DEADLINE_MS = 30_000

/**
 * Rasterising happens by loading the cloned DOM as an SVG image, and when that
 * image is too large the browser neither loads it nor reports an error — the
 * promise simply never settles. Left alone that jams the menu open forever, so
 * a stalled export is turned into one the caller can report.
 */
const withDeadline = <T>(work: Promise<T>): Promise<T> =>
  Promise.race([
    work,
    new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              'The diagram was too large to rasterise. Try exporting the current view, or a selection.',
            ),
          ),
        DEADLINE_MS,
      ),
    ),
  ])

/**
 * Rasterises the diagram to a PNG data URL.
 *
 * `modern-screenshot` is loaded here rather than imported at the top so that
 * the ~2.4MB bundle everyone downloads does not grow for a menu item most
 * visits never touch.
 *
 * The background is painted rather than left transparent: the viewer is dark,
 * and a transparent PNG dropped into a light document renders pale text on
 * white. What you get should be what you were looking at.
 *
 * Fonts are fetched and embedded by the library. A deployment that cannot reach
 * the font host — offline, or behind a proxy that blocks it — exports in the
 * fallback face instead of failing, which is why the timeout is a timeout and
 * not an error.
 */
export const captureDiagram = async (
  viewport: HTMLElement,
  frame: ImageFrame,
  backgroundColor: string,
): Promise<string> => {
  const { domToPng } = await import('modern-screenshot')

  return withDeadline(
    domToPng(viewport, {
      width: frame.width,
      height: frame.height,
      scale: frame.scale,
      backgroundColor,
      timeout: FETCH_TIMEOUT_MS,
      style: { transform: frame.transform, transformOrigin: '0 0' },
    }),
  )
}

/** The canvas colour, read from the theme so the image matches the screen. */
export const resolveCanvasBackground = (element: Element): string => {
  const value = getComputedStyle(element)
    .getPropertyValue('--pane-background')
    .trim()

  return value === '' ? '#141414' : value
}
