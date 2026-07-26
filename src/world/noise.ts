import { hash2i, lerp, smoothstep } from '../core/math-utils'

/** Seeded 2D value noise in [0, 1). Continuous across all world coordinates. */
export function noise2(x: number, y: number, seed: number): number {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = x - xi
  const yf = y - yi
  const a = hash2i(xi, yi, seed)
  const b = hash2i(xi + 1, yi, seed)
  const c = hash2i(xi, yi + 1, seed)
  const d = hash2i(xi + 1, yi + 1, seed)
  const u = smoothstep(xf)
  const v = smoothstep(yf)
  return lerp(lerp(a, b, u), lerp(c, d, u), v)
}

/** Fractal Brownian motion: octaves of value noise, normalized to [0, 1). */
export function fbm2(
  x: number,
  y: number,
  seed: number,
  octaves = 4,
  lacunarity = 2,
  gain = 0.5,
): number {
  let amp = 1
  let freq = 1
  let sum = 0
  let norm = 0
  for (let o = 0; o < octaves; o++) {
    sum += noise2(x * freq, y * freq, seed + o * 101) * amp
    norm += amp
    amp *= gain
    freq *= lacunarity
  }
  return sum / norm
}
