// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import clsx from 'clsx'
import type { FC, ReactNode } from 'react'
import { VIEW_COLORS, type ViewColorKey } from '../../../../utils'
import styles from './ViewColorMenu.module.css'

type Props = {
  x: number
  y: number
  selected: ViewColorKey | undefined
  onSelect: (color: ViewColorKey | null) => void
  /** Extra actions below the swatches, e.g. "Delete memo". */
  children?: ReactNode
}

/**
 * Right-click colour picker shared by tables and memos. Positioned with the
 * viewport coordinates of the originating event, so it is `position: fixed`
 * and does not move with the canvas.
 */
export const ViewColorMenu: FC<Props> = ({
  x,
  y,
  selected,
  onSelect,
  children,
}) => (
  // biome-ignore lint/a11y/noStaticElementInteractions: this only keeps clicks
  // from reaching the window listener that dismisses the menu.
  <div
    className={styles.menu}
    style={{ left: x, top: y }}
    onClick={(event) => event.stopPropagation()}
    onKeyDown={(event) => event.stopPropagation()}
  >
    <div className={styles.swatches}>
      <button
        type="button"
        aria-label="No color"
        title="No color"
        className={clsx(
          styles.swatch,
          styles.clear,
          selected === undefined && styles.selected,
        )}
        onClick={() => onSelect(null)}
      />
      {VIEW_COLORS.map((color) => (
        <button
          key={color.key}
          type="button"
          aria-label={color.key}
          title={color.key}
          className={clsx(
            styles.swatch,
            selected === color.key && styles.selected,
          )}
          style={{ backgroundColor: color.value }}
          onClick={() => onSelect(color.key)}
        />
      ))}
    </div>
    {children}
  </div>
)
