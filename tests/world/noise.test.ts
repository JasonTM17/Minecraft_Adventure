import { describe, expect, it } from 'vitest'
import { fbm2, noise2 } from '../../src/world/noise'

describe('noise2', () => {
  it('is deterministic for the same seed and coordinates', () => {
    expect(noise2(3.25, -7.5, 42)).toBe(noise2(3.25, -7.5, 42))
    expect(noise2(100.1, 200.9, 1)).toBe(noise2(100.1, 200.9, 1))
  })

  it('stays within [0, 1) across a grid of coordinates and seeds', () => {
    for (let seed = 0; seed < 5; seed++) {
      for (let x = -20; x <= 20; x += 2.5) {
        for (let y = -20; y <= 20; y += 2.5) {
          const v = noise2(x, y, seed)
          expect(v).toBeGreaterThanOrEqual(0)
          expect(v).toBeLessThan(1)
        }
      }
    }
  })

  it('produces a different field for different seeds', () => {
    const fieldA: number[] = []
    const fieldB: number[] = []
    for (let x = 0; x < 10; x++) {
      for (let y = 0; y < 10; y++) {
        fieldA.push(noise2(x + 0.37, y + 0.61, 1))
        fieldB.push(noise2(x + 0.37, y + 0.61, 2))
      }
    }
    expect(fieldA).not.toEqual(fieldB)
  })

  it('is continuous at integer lattice boundaries (matches the hash value)', () => {
    // At exact integer coordinates the bilinear blend collapses to the
    // corner hash value itself (u = v = 0).
    const seed = 11
    const x = 4
    const y = -2
    const atCorner = noise2(x, y, seed)
    const nearby = noise2(x + 0.001, y + 0.001, seed)
    expect(Math.abs(atCorner - nearby)).toBeLessThan(0.01)
  })
})

describe('fbm2', () => {
  it('is deterministic for the same seed and coordinates', () => {
    expect(fbm2(5.5, 6.5, 3)).toBe(fbm2(5.5, 6.5, 3))
  })

  it('stays within [0, 1) across a range of coordinates', () => {
    for (let x = -10; x <= 10; x += 1.3) {
      for (let y = -10; y <= 10; y += 1.3) {
        const v = fbm2(x, y, 5)
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThan(1)
      }
    }
  })

  it('produces different fields for different seeds', () => {
    const fieldA: number[] = []
    const fieldB: number[] = []
    for (let x = 0; x < 8; x++) {
      for (let y = 0; y < 8; y++) {
        fieldA.push(fbm2(x + 0.2, y + 0.8, 10))
        fieldB.push(fbm2(x + 0.2, y + 0.8, 20))
      }
    }
    expect(fieldA).not.toEqual(fieldB)
  })
})
