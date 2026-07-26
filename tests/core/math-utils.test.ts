import { describe, expect, it } from 'vitest'
import { clamp, hash2i, lerp, mulberry32, smoothstep } from '../../src/core/math-utils'

describe('clamp', () => {
  it('passes through values inside the range', () => {
    expect(clamp(5, 0, 10)).toBe(5)
  })

  it('clamps to the minimum edge', () => {
    expect(clamp(-3, 0, 10)).toBe(0)
    expect(clamp(0, 0, 10)).toBe(0)
  })

  it('clamps to the maximum edge', () => {
    expect(clamp(15, 0, 10)).toBe(10)
    expect(clamp(10, 0, 10)).toBe(10)
  })
})

describe('lerp', () => {
  it('returns a at t=0 and b at t=1', () => {
    expect(lerp(2, 8, 0)).toBe(2)
    expect(lerp(2, 8, 1)).toBe(8)
  })

  it('interpolates linearly at t=0.5', () => {
    expect(lerp(0, 10, 0.5)).toBe(5)
  })

  it('extrapolates outside [0,1]', () => {
    expect(lerp(0, 10, 2)).toBe(20)
  })
})

describe('smoothstep', () => {
  it('is 0 at t=0 and 1 at t=1', () => {
    expect(smoothstep(0)).toBe(0)
    expect(smoothstep(1)).toBe(1)
  })

  it('is 0.5 at the midpoint (symmetric curve)', () => {
    expect(smoothstep(0.5)).toBeCloseTo(0.5, 10)
  })

  it('is monotonically increasing across the domain', () => {
    let prev = smoothstep(0)
    for (let t = 0.1; t <= 1; t += 0.1) {
      const next = smoothstep(t)
      expect(next).toBeGreaterThanOrEqual(prev)
      prev = next
    }
  })
})

describe('mulberry32', () => {
  it('is deterministic for the same seed', () => {
    const a = mulberry32(1234)
    const b = mulberry32(1234)
    const seqA = Array.from({ length: 20 }, () => a())
    const seqB = Array.from({ length: 20 }, () => b())
    expect(seqA).toEqual(seqB)
  })

  it('produces different sequences for different seeds', () => {
    const a = mulberry32(1)
    const b = mulberry32(2)
    const seqA = Array.from({ length: 10 }, () => a())
    const seqB = Array.from({ length: 10 }, () => b())
    expect(seqA).not.toEqual(seqB)
  })

  it('stays within [0, 1) across many draws', () => {
    const rng = mulberry32(42)
    for (let i = 0; i < 1000; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('hash2i', () => {
  it('is deterministic for the same inputs', () => {
    expect(hash2i(5, -3, 99)).toBe(hash2i(5, -3, 99))
  })

  it('differs across coordinates', () => {
    expect(hash2i(0, 0, 1)).not.toBe(hash2i(1, 0, 1))
    expect(hash2i(0, 0, 1)).not.toBe(hash2i(0, 1, 1))
  })

  it('differs across seeds for the same coordinate', () => {
    expect(hash2i(10, 10, 1)).not.toBe(hash2i(10, 10, 2))
  })

  it('stays within [0, 1)', () => {
    for (let x = -5; x <= 5; x++) {
      for (let y = -5; y <= 5; y++) {
        const v = hash2i(x, y, 7)
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThan(1)
      }
    }
  })
})
