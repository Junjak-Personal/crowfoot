// Modified from the original Liam ERD source (Apache-2.0, ROUTE06, Inc.).
// See the NOTICE file at the repository root for what changed.
import { picklist } from 'valibot'

// 'show' replaced 'showMode' so the values can be typed by hand
// (?show=all|table|key). 'positions' and 'edit' are additions of this fork.
export const queryParamSchema = picklist([
  'active',
  'hidden',
  'show',
  'positions',
  'colors',
  'memos',
  'edit',
])
