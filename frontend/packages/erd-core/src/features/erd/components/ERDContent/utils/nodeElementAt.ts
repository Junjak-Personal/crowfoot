// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.

/**
 * The node element a canvas right-click refers to.
 *
 * `event.target` on its own is not enough. Once a drag selection lands, React
 * Flow lays a `.react-flow__nodesselection-rect` over the whole selection
 * bounding box, and that overlay — not the node under the pointer — becomes
 * the event target. Every right-click inside a multi-selection therefore found
 * no node and fell through to the pane menu, so the only entry on offer was
 * "Add memo here", never the table's colours, "Group selected tables" or
 * "Remove from …".
 *
 * `stack` yields the hit-test stack at the pointer
 * (`document.elementsFromPoint`), topmost first, which sees past the overlay.
 * Elements with `pointer-events: none` — the group boxes — are absent from it,
 * so a click on empty canvas inside a group box still resolves to no node, as
 * it must.
 *
 * It is a callback rather than an array because the overlay is the uncommon
 * case: when the target is already a node there is nothing to look past, and
 * the hit-test is never performed.
 */
export const nodeElementAt = (
  target: EventTarget | null,
  stack: () => Element[],
): Element | null => {
  if (target instanceof Element) {
    const direct = target.closest('.react-flow__node')
    if (direct !== null) return direct
  }

  for (const element of stack()) {
    const node = element.closest('.react-flow__node')
    if (node !== null) return node
  }

  return null
}
