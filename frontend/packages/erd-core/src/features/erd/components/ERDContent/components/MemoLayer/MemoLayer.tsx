// Added in erdkit; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import { useViewport } from '@xyflow/react'
import clsx from 'clsx'
import {
  type FC,
  type PointerEvent,
  type MouseEvent as ReactMouseEvent,
  useCallback,
} from 'react'
import {
  DEFAULT_MEMO_FONT_SIZE,
  type Memo,
  MIN_MEMO_HEIGHT,
  MIN_MEMO_WIDTH,
} from '../../../../utils'
import styles from './MemoLayer.module.css'

type Props = {
  memos: Memo[]
  editMode: boolean
  onChange: (memos: Memo[]) => void
  onContextMenu: (event: ReactMouseEvent, memo: Memo) => void
}

/**
 * Free-form notes pinned to the canvas.
 *
 * Read-only unless `?edit=1`, so a shared link cannot be rearranged by
 * accident. Like the group boxes this is an overlay rather than React Flow
 * nodes: memos must not end up in the ELK layout or the saved table positions.
 */
export const MemoLayer: FC<Props> = ({
  memos,
  editMode,
  onChange,
  onContextMenu,
}) => {
  const { x, y, zoom } = useViewport()

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>, memo: Memo) => {
      if (!editMode) return
      // Let the textarea and the delete button do their own thing.
      if (event.target !== event.currentTarget) return

      event.stopPropagation()
      event.currentTarget.setPointerCapture(event.pointerId)

      const startX = event.clientX
      const startY = event.clientY
      const originX = memo.x
      const originY = memo.y

      const move = (moveEvent: globalThis.PointerEvent) => {
        // Screen delta has to be divided by zoom to become a flow delta.
        const next = {
          ...memo,
          x: originX + (moveEvent.clientX - startX) / zoom,
          y: originY + (moveEvent.clientY - startY) / zoom,
        }
        onChange(memos.map((m) => (m.id === memo.id ? next : m)))
      }

      const up = () => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
      }

      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
    },
    [editMode, memos, onChange, zoom],
  )

  const handleResizeDown = useCallback(
    (event: PointerEvent<HTMLDivElement>, memo: Memo) => {
      event.stopPropagation()

      const startX = event.clientX
      const startY = event.clientY
      const originWidth = memo.width
      const originHeight = memo.height

      const move = (moveEvent: globalThis.PointerEvent) => {
        const next = {
          ...memo,
          width: Math.max(
            MIN_MEMO_WIDTH,
            originWidth + (moveEvent.clientX - startX) / zoom,
          ),
          height: Math.max(
            MIN_MEMO_HEIGHT,
            originHeight + (moveEvent.clientY - startY) / zoom,
          ),
        }
        onChange(memos.map((m) => (m.id === memo.id ? next : m)))
      }

      const up = () => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
      }

      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
    },
    [memos, onChange, zoom],
  )

  if (memos.length === 0) return null

  return (
    <div
      className={styles.layer}
      // Match React Flow's pane transform so memos pan and zoom with it.
      style={{ transform: `translate(${x}px, ${y}px) scale(${zoom})` }}
    >
      {memos.map((memo) => (
        <div
          key={memo.id}
          className={clsx(
            styles.memo,
            editMode && styles.editable,
            memo.color && styles.tinted,
          )}
          style={{
            left: memo.x,
            top: memo.y,
            width: memo.width,
            height: memo.height,
            fontSize: memo.fontSize ?? DEFAULT_MEMO_FONT_SIZE,
          }}
          data-view-color={memo.color}
          onPointerDown={(event) => handlePointerDown(event, memo)}
          onContextMenu={(event) => onContextMenu(event, memo)}
        >
          {editMode ? (
            <>
              <button
                type="button"
                className={styles.remove}
                aria-label="Delete memo"
                onClick={() => onChange(memos.filter((m) => m.id !== memo.id))}
              >
                ×
              </button>
              <textarea
                className={styles.input}
                value={memo.text}
                placeholder="Write a memo"
                onChange={(event) =>
                  onChange(
                    memos.map((m) =>
                      m.id === memo.id ? { ...m, text: event.target.value } : m,
                    ),
                  )
                }
              />
              {/* biome-ignore lint/a11y/noStaticElementInteractions: a drag
                  handle has no keyboard equivalent; width and height are also
                  editable as numbers in memos.json. */}
              <div
                className={styles.resize}
                onPointerDown={(event) => handleResizeDown(event, memo)}
              />
            </>
          ) : (
            memo.text
          )}
        </div>
      ))}
    </div>
  )
}
