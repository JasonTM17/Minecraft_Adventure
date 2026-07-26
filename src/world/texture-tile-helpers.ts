/** Low-level pixel helpers shared by the terrain atlas and mob skin tiles. */

export const TILE_PX = 16
export const ATLAS_GRID = 16
export const ATLAS_PX = TILE_PX * ATLAS_GRID

export type RGB = readonly [number, number, number]

export function rgb(c: RGB, delta = 0): string {
  const r = Math.max(0, Math.min(255, c[0] + delta))
  const g = Math.max(0, Math.min(255, c[1] + delta))
  const b = Math.max(0, Math.min(255, c[2] + delta))
  return `rgb(${r | 0},${g | 0},${b | 0})`
}

/** Fill one pixel-space rect inside tile (tx, ty). */
export function pxRect(
  ctx: CanvasRenderingContext2D,
  tx: number,
  ty: number,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
): void {
  ctx.fillStyle = color
  ctx.fillRect(tx * TILE_PX + x, ty * TILE_PX + y, w, h)
}

/** Fill a whole tile with per-pixel brightness jitter for that classic voxel grain. */
export function noiseTile(
  ctx: CanvasRenderingContext2D,
  tx: number,
  ty: number,
  base: RGB,
  jitter: number,
  rng: () => number,
): void {
  for (let y = 0; y < TILE_PX; y++) {
    for (let x = 0; x < TILE_PX; x++) {
      const d = (rng() - 0.5) * 2 * jitter
      pxRect(ctx, tx, ty, x, y, 1, 1, rgb(base, d))
    }
  }
}

/**
 * Draw an ASCII pixel pattern. Each row string maps characters to colors;
 * '.' (or space) leaves the pixel untouched. scale stretches pattern pixels.
 */
export function drawPattern(
  ctx: CanvasRenderingContext2D,
  tx: number,
  ty: number,
  rows: readonly string[],
  colors: Readonly<Record<string, string>>,
  scale = 1,
  ox = 0,
  oy = 0,
): void {
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y] as string
    for (let x = 0; x < row.length; x++) {
      const ch = row[x] as string
      if (ch === '.' || ch === ' ') continue
      const color = colors[ch]
      if (!color) continue
      pxRect(ctx, tx, ty, ox + x * scale, oy + y * scale, scale, scale, color)
    }
  }
}

/** Erase pixels (used for leaf holes and cross-plant transparent backgrounds). */
export function clearTile(ctx: CanvasRenderingContext2D, tx: number, ty: number): void {
  ctx.clearRect(tx * TILE_PX, ty * TILE_PX, TILE_PX, TILE_PX)
}

export function clearPx(
  ctx: CanvasRenderingContext2D,
  tx: number,
  ty: number,
  x: number,
  y: number,
): void {
  ctx.clearRect(tx * TILE_PX + x, ty * TILE_PX + y, 1, 1)
}
