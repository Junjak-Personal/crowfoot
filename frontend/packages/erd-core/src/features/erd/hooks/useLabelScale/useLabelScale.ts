// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import { useStoreApi } from '@xyflow/react'
import { type RefObject, useEffect } from 'react'
import {
  LABEL_HOLD_ZOOM,
  LABEL_SCALE_STEP,
  MAX_LABEL_SCALE,
} from '../../../reactflow/constants'

/**
 * Holds a name at a steady on-screen size while the canvas is zoomed out, by
 * publishing the counter-scale as `--label-scale` on the canvas element. Only
 * the styles that draw a name on its own pick it up, so a header never grows
 * out of step with the column rows under it.
 *
 * A CSS variable written from a store subscription rather than a rendered
 * value: a zoom gesture moves this every frame, and re-rendering every table
 * per frame is exactly the cost that shows up on the diagrams big enough to
 * need this in the first place. Rounding to `LABEL_SCALE_STEP` cuts what is
 * left — a gesture crosses a handful of steps, not a hundred.
 *
 * Font size rather than a transform on the box, because React Flow measures
 * what it renders: a name that needs more room grows the node it sits in, and
 * the handles — so the edges — move with it. A transform would leave the edges
 * pointing at where the box used to end.
 */
export const useLabelScale = (canvas: RefObject<HTMLDivElement | null>) => {
  const store = useStoreApi()

  useEffect(() => {
    let written = ''

    const write = (zoom: number) => {
      const held = Math.min(
        MAX_LABEL_SCALE,
        Math.max(1, LABEL_HOLD_ZOOM / zoom),
      )
      const scale = Math.round(held / LABEL_SCALE_STEP) * LABEL_SCALE_STEP
      const next = String(scale)
      if (next === written) return

      written = next
      canvas.current?.style.setProperty('--label-scale', next)
    }

    write(store.getState().transform[2])

    return store.subscribe((state) => write(state.transform[2]))
  }, [store, canvas])
}
