// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import { describe, expect, it } from 'vitest'
import { nodeElementAt } from './nodeElementAt'

/**
 * Builds the DOM shape React Flow renders: a viewport holding node wrappers,
 * each with an inner element the pointer actually lands on, plus the pane and
 * the selection overlay that a drag selection adds.
 */
const aCanvas = () => {
  const viewport = document.createElement('div')

  const pane = document.createElement('div')
  pane.className = 'react-flow__pane'
  viewport.append(pane)

  const nodeInner = (id: string) => {
    const node = document.createElement('div')
    node.className = 'react-flow__node react-flow__node-table'
    node.setAttribute('data-id', id)
    const inner = document.createElement('div')
    node.append(inner)
    viewport.append(node)
    return inner
  }

  const selectionRect = document.createElement('div')
  selectionRect.className = 'react-flow__nodesselection-rect'
  viewport.append(selectionRect)

  return { pane, nodeInner, selectionRect }
}

describe('nodeElementAt', () => {
  it('resolves the node from the event target when nothing covers it', () => {
    const { nodeInner } = aCanvas()
    const inner = nodeInner('users')

    const element = nodeElementAt(inner, () => [])

    expect(element?.getAttribute('data-id')).toBe('users')
  })

  // The drag-selection regression: React Flow lays `.react-flow__nodesselection
  // -rect` over the whole selection, so the target is the overlay and the old
  // `event.target.closest()` returned null — every right-click inside a
  // multi-selection opened the pane menu ("Add memo here") instead of the
  // table menu.
  it('looks past the drag-selection overlay to the node under the pointer', () => {
    const { nodeInner, selectionRect } = aCanvas()
    const inner = nodeInner('users')

    const element = nodeElementAt(selectionRect, () => [selectionRect, inner])

    expect(element?.getAttribute('data-id')).toBe('users')
  })

  it('takes the topmost node when the stack holds several', () => {
    const { nodeInner, selectionRect } = aCanvas()
    const top = nodeInner('users')
    const beneath = nodeInner('accounts')

    const element = nodeElementAt(selectionRect, () => [
      selectionRect,
      top,
      beneath,
    ])

    expect(element?.getAttribute('data-id')).toBe('users')
  })

  // Group boxes are `pointer-events: none`, so they never enter the hit-test
  // stack — empty canvas inside a group box has to stay the pane menu.
  it('resolves no node for empty canvas, overlay or not', () => {
    const { pane, selectionRect } = aCanvas()

    expect(nodeElementAt(pane, () => [pane])).toBeNull()
    expect(nodeElementAt(selectionRect, () => [selectionRect, pane])).toBeNull()
  })

  it('resolves no node when the target is not an Element', () => {
    expect(nodeElementAt(null, () => [])).toBeNull()
  })
})
