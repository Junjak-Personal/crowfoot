// Added in erdkit; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import type { Node } from '@xyflow/react'
import { zIndex } from '../../constants'
import type { MemoNodeType } from '../../types'
import { DEFAULT_MEMO_HEIGHT, DEFAULT_MEMO_WIDTH, type Memo } from './memo'

export const isMemoNode = (node: Node): node is MemoNodeType =>
  node.type === 'memo'

/**
 * `memos.json` and `?memos=` keep the flat record; the canvas wants a node.
 * Keeping the two shapes separate is what lets React Flow own position and
 * size without the stored format having to know about React Flow at all.
 */
export const memoToNode = (memo: Memo): MemoNodeType => ({
  id: memo.id,
  type: 'memo',
  position: { x: memo.x, y: memo.y },
  width: memo.width,
  height: memo.height,
  // Above tables, which is where the overlay this replaced used to sit.
  zIndex: zIndex.nodeDefault + 1,
  data: { text: memo.text, color: memo.color, fontSize: memo.fontSize },
})

export const nodeToMemo = (node: MemoNodeType): Memo => ({
  id: node.id,
  text: node.data.text,
  x: node.position.x,
  y: node.position.y,
  // A node that has never been measured or resized reports no size.
  width: node.width ?? DEFAULT_MEMO_WIDTH,
  height: node.height ?? DEFAULT_MEMO_HEIGHT,
  color: node.data.color,
  fontSize: node.data.fontSize,
})

/** Memo nodes on the canvas, in the shape `memos.json` is written in. */
export const memosFromNodes = (nodes: Node[]): Memo[] =>
  nodes.filter(isMemoNode).map(nodeToMemo)

export const memoNodesFrom = (memos: Memo[]): MemoNodeType[] =>
  memos.map(memoToNode)
