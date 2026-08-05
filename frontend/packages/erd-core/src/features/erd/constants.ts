// Modified from the original Liam ERD source (Apache-2.0, ROUTE06, Inc.).
// See the NOTICE file at the repository root for what changed.
export const zIndex = {
  nodeDefault: 2,
  edgeHighlighted: 1,
  edgeDefault: 0,
  // Written out explicitly, never derived as `nodeDefault - 1` (which
  // evaluates to 1 and collides with `edgeHighlighted`). The group box is a
  // backdrop: below every table AND below every edge.
  tableGroupBox: -1,
}

export const NON_RELATED_TABLE_GROUP_NODE_ID = 'non-related-table-group'
