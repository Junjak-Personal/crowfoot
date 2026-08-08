// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import type { ImageFrame } from './frame'

/**
 * The layer holding the nodes. Capturing this rather than the whole pane is
 * what leaves the zoom controls, the show-mode bar and React Flow's own badge
 * out of the picture — they are siblings of it, not children.
 */
const VIEWPORT_SELECTOR = '.react-flow__viewport'

export const findViewport = (root: ParentNode = document): HTMLElement | null =>
  root.querySelector<HTMLElement>(VIEWPORT_SELECTOR)

/** Past this the export is treated as failed rather than merely slow. */
const DEADLINE_MS = 30_000

/** SVG attributes whose value can be a `url(#id)` pointing at a definition. */
const REFERENCE_ATTRIBUTES = [
  'marker-start',
  'marker-mid',
  'marker-end',
  'fill',
  'stroke',
  'filter',
  'clip-path',
  'mask',
]

const referencedId = (value: string | null): string | null => {
  const match = value?.match(/^url\(["']?#(.+?)["']?\)$/)
  return match?.[1] ?? null
}

/**
 * The `<svg>` elements defining things the captured subtree points at but does
 * not contain.
 *
 * The crow's feet and the "1" rings on a relationship are `<marker>`s, and the
 * app declares them once beside the pane rather than inside it — outside
 * anything an export of the diagram layer would take. A capture without them
 * draws every relationship as a bare line with nothing on either end.
 */
const findExternalDefinitions = (root: HTMLElement): SVGSVGElement[] => {
  const selector = REFERENCE_ATTRIBUTES.map((name) => `[${name}]`).join(',')
  const found: SVGSVGElement[] = []

  for (const element of Array.from(root.querySelectorAll(selector))) {
    for (const attribute of REFERENCE_ATTRIBUTES) {
      const id = referencedId(element.getAttribute(attribute))
      if (id === null) continue

      const owner = document.getElementById(id)?.closest('svg')
      if (owner && !root.contains(owner) && !found.includes(owner)) {
        found.push(owner)
      }
    }
  }

  return found
}

/**
 * Puts copies of those definitions inside the subtree for the length of the
 * capture, and returns the undo.
 *
 * The copies carry the same ids as the originals, which is only safe because
 * they are added *after* them: a duplicate id resolves to whichever comes first
 * in the document, so what is on screen goes on pointing at the original and
 * looks no different while this is in place.
 */
const lendDefinitions = (root: HTMLElement): (() => void) => {
  const copies = findExternalDefinitions(root).map((svg) => {
    const copy = root.appendChild(svg.cloneNode(true))
    return copy instanceof Element ? copy : null
  })

  return () => {
    for (const copy of copies) copy?.remove()
  }
}

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
 * `html-to-image`, pinned, and not the better-maintained `modern-screenshot`:
 * that one drops the whole `.react-flow__edges` layer, so the tables come out
 * with none of the relationships between them. Sizing the layer, forcing a
 * stroke onto every path and turning off its attribute normalisation each
 * changed nothing. This is the library React Flow's own download-image example
 * uses, and it draws them.
 *
 * Loaded here rather than imported at the top so that the ~2.4MB bundle
 * everyone downloads does not grow for a menu item most visits never touch.
 *
 * The background is painted rather than left transparent: the viewer is dark,
 * and a transparent PNG dropped into a light document renders pale text on
 * white. What you get should be what you were looking at.
 *
 * Fonts are fetched and embedded by the library. A deployment that cannot reach
 * the font host — offline, or behind a proxy that blocks it — exports in the
 * fallback face rather than failing.
 */
export const captureDiagram = async (
  viewport: HTMLElement,
  frame: ImageFrame,
  backgroundColor: string,
): Promise<string> => {
  const { toPng } = await import('html-to-image')
  const returnDefinitions = lendDefinitions(viewport)

  try {
    return await withDeadline(
      toPng(viewport, {
        width: frame.width,
        height: frame.height,
        pixelRatio: frame.scale,
        backgroundColor,
        style: { transform: frame.transform, transformOrigin: '0 0' },
      }),
    )
  } finally {
    returnDefinitions()
  }
}

/** The canvas colour, read from the theme so the image matches the screen. */
export const resolveCanvasBackground = (element: Element): string => {
  const value = getComputedStyle(element)
    .getPropertyValue('--pane-background')
    .trim()

  return value === '' ? '#141414' : value
}
