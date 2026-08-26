// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import { useSyncExternalStore } from 'react'
import {
  getLodSettings,
  type LodSettings,
  subscribeLodSettings,
} from '../../utils/lodSettings/lodSettings.js'

/**
 * An external store rather than context: every table on the canvas reads this,
 * and it changes when someone opens a menu and types a number — putting it in
 * a provider would mean threading it through a tree that has no other reason
 * to know about it.
 */
export const useLodSettings = (): LodSettings =>
  useSyncExternalStore(subscribeLodSettings, getLodSettings, getLodSettings)
