/** Shared math helpers and deterministic RNG used across world gen, AI and effects. */

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function smoothstep(t: number): number {
  return t * t * (3 - 2 * t)
}

/** Shortest-path angle interpolation, keeps mobs turning naturally across the ±PI seam. */
export function lerpAngle(a: number, b: number, t: number): number {
  let d = (b - a) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return a + d * t
}

/** Fast seedable PRNG (Mulberry32). Returns floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Deterministic hash of an integer 2D coordinate + seed to [0, 1). */
export function hash2i(x: number, y: number, seed: number): number {
  let h = seed >>> 0
  h = Math.imul(h ^ (x | 0), 0x85ebca6b)
  h = Math.imul(h ^ (y | 0), 0xc2b2ae35)
  h ^= h >>> 13
  h = Math.imul(h, 0x27d4eb2f)
  h ^= h >>> 15
  return (h >>> 0) / 4294967296
}

export function distance2D(x1: number, z1: number, x2: number, z2: number): number {
  const dx = x2 - x1
  const dz = z2 - z1
  return Math.sqrt(dx * dx + dz * dz)
}

export function randRange(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min)
}

export function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)] as T
}
