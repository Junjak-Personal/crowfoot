import { describe, expect, it } from 'vitest'
import { frameForBounds, frameForPane, isEmptyBounds } from './frame'

describe('frameForBounds', () => {
  it('pads the region and moves it to the origin', () => {
    const frame = frameForBounds({ x: 100, y: -50, width: 800, height: 600 })

    expect(frame).toEqual({
      width: 880,
      height: 680,
      transform: 'translate(-60px, 90px)',
      scale: 2,
    })
  })

  it('exports at full resolution while it fits', () => {
    expect(
      frameForBounds({ x: 0, y: 0, width: 4000, height: 1000 }).scale,
    ).toBe(2)
  })

  it('gives up resolution rather than exceeding the canvas area', () => {
    // The demo diagram. At 2x it would cover 79M pixels.
    const frame = frameForBounds({ x: 0, y: 0, width: 6600, height: 2900 })

    expect(frame.width).toBe(6680)
    expect(frame.scale).toBeLessThan(2)
    expect(
      frame.width * frame.scale * (frame.height * frame.scale),
    ).toBeCloseTo(40_000_000, -3)
  })

  it('keeps the longest side under the limit however extreme the shape', () => {
    const frame = frameForBounds({ x: 0, y: 0, width: 200, height: 900_000 })

    expect(frame.height * frame.scale).toBeCloseTo(16_384)
  })

  /**
   * A tall diagram used to be clamped on its long side alone, which shrank the
   * short side past legibility for no reason — the area was never the problem.
   */
  it('does not shrink a tall diagram on account of its height alone', () => {
    const frame = frameForBounds({ x: 0, y: 0, width: 4043, height: 17_598 })

    expect(frame.scale).toBeGreaterThan(0.7)
    expect(frame.height * frame.scale).toBeLessThan(16_384)
  })
})

describe('frameForPane', () => {
  it('restates the pan and zoom on screen rather than inheriting them', () => {
    expect(
      frameForPane({ width: 1280, height: 720 }, { x: -40, y: 12, zoom: 0.75 }),
    ).toEqual({
      width: 1280,
      height: 720,
      transform: 'translate(-40px, 12px) scale(0.75)',
      scale: 2,
    })
  })
})

describe('isEmptyBounds', () => {
  it.each([
    { x: 0, y: 0, width: 0, height: 0 },
    { x: 0, y: 0, width: 100, height: 0 },
    // getNodesBounds answers -Infinity when handed nothing measured.
    { x: 0, y: 0, width: Number.NEGATIVE_INFINITY, height: 100 },
  ])('is empty for %o', (bounds) => {
    expect(isEmptyBounds(bounds)).toBe(true)
  })

  it('is not empty once something has a size', () => {
    expect(isEmptyBounds({ x: 0, y: 0, width: 1, height: 1 })).toBe(false)
  })
})
