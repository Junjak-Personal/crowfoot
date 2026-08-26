// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import { type NodeProps, NodeResizer } from '@xyflow/react'
import clsx from 'clsx'
import type { FC } from 'react'
import { type EditWrite, useUserEditingOrThrow } from '../../../../../../stores'
import { useMemoNodes, useTextDraft } from '../../../../hooks'
import type { MemoNodeType } from '../../../../types'
import {
  DEFAULT_MEMO_FONT_SIZE,
  MIN_MEMO_HEIGHT,
  MIN_MEMO_WIDTH,
} from '../../../../utils'
import styles from './MemoNode.module.css'

type Props = NodeProps<MemoNodeType>

/**
 * A free-form note pinned to the canvas.
 *
 * Read-only unless `?edit=1`, so a shared link cannot be rearranged by
 * accident. Being a React Flow node rather than an overlay is what makes
 * selection, multi-selection, dragging and resizing React Flow's job — the
 * pieces below are only the note itself.
 */
export const MemoNode: FC<Props> = ({ id, data, selected }) => {
  const { editMode } = useUserEditingOrThrow()
  const { commitMemos } = useMemoNodes()
  const draft = useTextDraft(data.text)

  /**
   * Every keystroke writes the link, so these are transient: one history entry
   * per character would make the back button useless for undoing anything
   * larger than a letter. Leaving the field commits the sentence as one.
   */
  const setText = (text: string, write?: EditWrite) =>
    commitMemos(
      (nodes) =>
        nodes.map((node) =>
          node.id === id ? { ...node, data: { ...node.data, text } } : node,
        ),
      write,
    )

  const remove = () =>
    commitMemos((nodes) => nodes.filter((node) => node.id !== id))

  return (
    <>
      <NodeResizer
        isVisible={editMode && Boolean(selected)}
        minWidth={MIN_MEMO_WIDTH}
        minHeight={MIN_MEMO_HEIGHT}
        color="var(--primary-accent)"
        // React Flow has already written the new size into the node by the
        // time this fires; committing here is what mirrors it into storage
        // and the link.
        onResizeEnd={() => commitMemos((nodes) => nodes)}
      />
      <div
        className={clsx(
          styles.memo,
          editMode && styles.editable,
          data.color && styles.tinted,
        )}
        style={{ fontSize: data.fontSize ?? DEFAULT_MEMO_FONT_SIZE }}
        data-view-color={data.color}
      >
        {editMode ? (
          <>
            <button
              type="button"
              className={clsx(styles.remove, 'nodrag')}
              aria-label="Delete memo"
              onClick={remove}
            >
              ×
            </button>
            {/* `nodrag` keeps a text selection inside the note from dragging
                the node out from under the caret. */}
            <textarea
              className={clsx(styles.input, 'nodrag')}
              value={draft.value}
              placeholder="Write a memo"
              onChange={(event) => {
                draft.edit(event.target.value)
                setText(event.target.value, { transient: true })
              }}
              onBlur={(event) => {
                draft.release()
                setText(event.target.value)
              }}
            />
          </>
        ) : (
          data.text
        )}
      </div>
    </>
  )
}
