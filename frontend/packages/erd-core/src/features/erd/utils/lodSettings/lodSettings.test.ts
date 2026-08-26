// Added in crowfoot; not part of the original Liam ERD source.
// See the NOTICE file at the repository root.
import { describe, expect, it } from 'vitest'
import { DEFAULT_LOD_SETTINGS, normalizeLodSettings } from './lodSettings.js'

/**
 * The settings come out of `localStorage`, which anyone can edit and any older
 * release may have written. Every value that reaches the canvas goes through
 * here first, so a bad one costs a default rather than a diagram that will not
 * draw.
 */
describe('normalizeLodSettings', () => {
  it('keeps a pair that makes sense', () => {
    expect(
      normalizeLodSettings({ nameOnlyZoom: 0.6, groupOnlyZoom: 0.3 }),
    ).toEqual({ nameOnlyZoom: 0.6, groupOnlyZoom: 0.3 })
  })

  /**
   * A group rung above the table rung leaves no zoom at which a table draws
   * its name, which is not a setting anyone means.
   */
  it('never lets the group rung sit above the table rung', () => {
    expect(
      normalizeLodSettings({ nameOnlyZoom: 0.4, groupOnlyZoom: 0.9 }),
    ).toEqual({ nameOnlyZoom: 0.4, groupOnlyZoom: 0.4 })
  })

  it.each([
    ['below the canvas minimum', { nameOnlyZoom: 0.05, groupOnlyZoom: 0.02 }],
    ['above the canvas maximum', { nameOnlyZoom: 3, groupOnlyZoom: 0.2 }],
    ['not a number', { nameOnlyZoom: Number.NaN, groupOnlyZoom: 0.2 }],
  ])('falls back to the defaults when a value is %s', (_, settings) => {
    expect(normalizeLodSettings(settings)).toEqual(DEFAULT_LOD_SETTINGS)
  })
})
