// Modified from the original Liam ERD source (Apache-2.0, ROUTE06, Inc.).
// See the NOTICE file at the repository root for what changed.
export const zIndex = {
  edgeDefault: 0,
  edgeHighlighted: 1,
  // Above the edges, below the tables. The box is a backdrop for the tables,
  // so it stays under them — but it carries the group's name, and an edge is a
  // hairline crossing an opaque label. Written out explicitly, never derived
  // as `nodeDefault - 1`, so a change to one end of the scale cannot silently
  // collide with the other.
  tableGroupBox: 2,
  nodeDefault: 3,
}

export const NON_RELATED_TABLE_GROUP_NODE_ID = 'non-related-table-group'
