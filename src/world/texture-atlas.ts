import * as THREE from 'three'
import { mulberry32 } from '../core/math-utils'
import { MOB_TILES, drawMobSkinTiles } from './mob-skin-tiles'
import {
  ATLAS_GRID,
  ATLAS_PX,
  clearPx,
  clearTile,
  drawPattern,
  noiseTile,
  pxRect,
  rgb,
} from './texture-tile-helpers'

/** All atlas tile indices. Terrain row 0, mobs row 1, deco/icons row 2. */
export const T = {
  GRASS_TOP: 0,
  GRASS_SIDE: 1,
  DIRT: 2,
  STONE: 3,
  COBBLE: 4,
  SAND: 5,
  SNOW: 6,
  SNOW_SIDE: 7,
  WATER: 8,
  LOG_SIDE: 9,
  LOG_TOP: 10,
  LEAVES: 11,
  PLANKS: 12,
  OBSIDIAN: 13,
  CRYSTAL: 14,
  GLOWSTONE: 15,
  ...MOB_TILES,
  FLOWER_RED: 32,
  FLOWER_YELLOW: 33,
  TALL_GRASS: 34,
  SWORD_ICON: 35,
  BOW_ICON: 36,
  MEAT_ICON: 37,
  ARROW_ICON: 38,
  HEART_FULL: 39,
  HEART_EMPTY: 40,
  BEDROCK: 41,
} as const

export interface AtlasResult {
  texture: THREE.CanvasTexture
  canvas: HTMLCanvasElement
}

/** UV rect (u0, v0, u1, v1) for a tile, bottom-left origin, quarter-texel inset. */
export function tileUV(index: number): readonly [number, number, number, number] {
  const col = index % ATLAS_GRID
  const row = Math.floor(index / ATLAS_GRID)
  const inv = 1 / ATLAS_GRID
  const e = 1 / (ATLAS_PX * 4)
  return [col * inv + e, 1 - (row + 1) * inv + e, (col + 1) * inv - e, 1 - row * inv - e]
}

function drawTerrainTiles(ctx: CanvasRenderingContext2D, rng: () => number): void {
  noiseTile(ctx, T.GRASS_TOP, 0, [106, 170, 64], 14, rng)

  noiseTile(ctx, T.GRASS_SIDE, 0, [134, 96, 67], 12, rng)
  for (let x = 0; x < 16; x++) {
    const h = 3 + ((x * 7) % 3)
    for (let y = 0; y < h; y++) {
      pxRect(ctx, T.GRASS_SIDE, 0, x, y, 1, 1, rgb([106, 170, 64], (rng() - 0.5) * 24))
    }
  }

  noiseTile(ctx, T.DIRT, 0, [134, 96, 67], 12, rng)

  noiseTile(ctx, T.STONE, 0, [125, 125, 125], 8, rng)
  for (let i = 0; i < 6; i++) {
    pxRect(ctx, T.STONE, 0, (rng() * 14) | 0, (rng() * 15) | 0, 2, 1, rgb([104, 104, 104]))
  }

  noiseTile(ctx, T.COBBLE, 0, [110, 110, 110], 18, rng)
  for (let cy = 0; cy < 4; cy++) {
    for (let cx = 0; cx < 4; cx++) {
      pxRect(ctx, T.COBBLE, 0, cx * 4, cy * 4, 4, 1, rgb([78, 78, 78], (rng() - 0.5) * 16))
      pxRect(ctx, T.COBBLE, 0, cx * 4, cy * 4, 1, 4, rgb([84, 84, 84], (rng() - 0.5) * 16))
    }
  }

  noiseTile(ctx, T.SAND, 0, [219, 207, 163], 10, rng)
  noiseTile(ctx, T.SNOW, 0, [240, 246, 250], 5, rng)

  noiseTile(ctx, T.SNOW_SIDE, 0, [134, 96, 67], 12, rng)
  for (let x = 0; x < 16; x++) {
    const h = 3 + ((x * 5) % 3)
    for (let y = 0; y < h; y++) {
      pxRect(ctx, T.SNOW_SIDE, 0, x, y, 1, 1, rgb([240, 246, 250], (rng() - 0.5) * 10))
    }
  }

  noiseTile(ctx, T.WATER, 0, [47, 93, 197], 10, rng)
  for (let i = 0; i < 5; i++) {
    pxRect(ctx, T.WATER, 0, (rng() * 10) | 0, (rng() * 15) | 0, 3 + ((rng() * 4) | 0), 1, rgb([70, 124, 228]))
  }

  for (let x = 0; x < 16; x++) {
    const dark = x % 4 === 0
    for (let y = 0; y < 16; y++) {
      pxRect(ctx, T.LOG_SIDE, 0, x, y, 1, 1, rgb(dark ? [86, 66, 40] : [107, 84, 53], (rng() - 0.5) * 12))
    }
  }

  noiseTile(ctx, T.LOG_TOP, 0, [107, 84, 53], 8, rng)
  for (const inset of [2, 5]) {
    const size = 16 - inset * 2
    pxRect(ctx, T.LOG_TOP, 0, inset, inset, size, 1, rgb([160, 130, 85]))
    pxRect(ctx, T.LOG_TOP, 0, inset, inset + size - 1, size, 1, rgb([160, 130, 85]))
    pxRect(ctx, T.LOG_TOP, 0, inset, inset, 1, size, rgb([160, 130, 85]))
    pxRect(ctx, T.LOG_TOP, 0, inset + size - 1, inset, 1, size, rgb([160, 130, 85]))
  }
  pxRect(ctx, T.LOG_TOP, 0, 7, 7, 2, 2, rgb([160, 130, 85]))

  noiseTile(ctx, T.LEAVES, 0, [58, 121, 39], 18, rng)
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (rng() < 0.1) clearPx(ctx, T.LEAVES, 0, x, y)
    }
  }

  noiseTile(ctx, T.PLANKS, 0, [168, 133, 86], 8, rng)
  for (const y of [0, 4, 8, 12]) {
    pxRect(ctx, T.PLANKS, 0, 0, y, 16, 1, rgb([120, 94, 58]))
  }
  pxRect(ctx, T.PLANKS, 0, 4, 4, 1, 4, rgb([120, 94, 58]))
  pxRect(ctx, T.PLANKS, 0, 11, 12, 1, 4, rgb([120, 94, 58]))
  pxRect(ctx, T.PLANKS, 0, 8, 0, 1, 4, rgb([120, 94, 58]))

  noiseTile(ctx, T.OBSIDIAN, 0, [23, 18, 33], 6, rng)
  for (let i = 0; i < 7; i++) {
    pxRect(ctx, T.OBSIDIAN, 0, (rng() * 15) | 0, (rng() * 15) | 0, 1, 1, rgb([72, 48, 110]))
  }

  noiseTile(ctx, T.CRYSTAL, 0, [210, 60, 230], 30, rng)
  drawPattern(ctx, T.CRYSTAL, 0, [
    '...W....',
    '..WW....',
    '.WW.....',
    'WW......',
    '........',
    '......W.',
    '.....WW.',
    '........',
  ], { W: '#ffe9ff' }, 2)

  noiseTile(ctx, T.GLOWSTONE, 0, [144, 110, 70], 12, rng)
  for (let i = 0; i < 8; i++) {
    pxRect(ctx, T.GLOWSTONE, 0, (rng() * 13) | 0, (rng() * 13) | 0, 2, 2, rgb([250, 215, 120]))
  }
}

function drawDecoAndIconTiles(ctx: CanvasRenderingContext2D, rng: () => number): void {
  const deco = (tile: number, rows: readonly string[], colors: Record<string, string>) => {
    const tx = tile % ATLAS_GRID
    const ty = Math.floor(tile / ATLAS_GRID)
    clearTile(ctx, tx, ty)
    drawPattern(ctx, tx, ty, rows, colors, 2)
  }

  deco(T.FLOWER_RED, [
    '........',
    '...RR...',
    '..RYYR..',
    '...RR...',
    '....G...',
    '....G...',
    '...GG...',
    '....G...',
  ], { R: rgb([214, 48, 48]), Y: rgb([250, 220, 90]), G: rgb([64, 130, 46]) })

  deco(T.FLOWER_YELLOW, [
    '........',
    '...YY...',
    '..YOOY..',
    '...YY...',
    '....G...',
    '....G...',
    '...GG...',
    '....G...',
  ], { Y: rgb([244, 208, 62]), O: rgb([190, 120, 30]), G: rgb([64, 130, 46]) })

  deco(T.TALL_GRASS, [
    '........',
    '.G...G..',
    '.G.G.G..',
    '..GG.G..',
    '..GGG...',
    '..G.GG..',
    '..G.G...',
    '..GGG...',
  ], { G: rgb([84, 152, 56]) })

  deco(T.SWORD_ICON, [
    '......WW',
    '.....WWW',
    '....WWW.',
    '...WWW..',
    'H.WWW...',
    '.HWW....',
    '.HH.....',
    'H..H....',
  ], { W: rgb([200, 208, 216]), H: rgb([120, 86, 46]) })

  deco(T.BOW_ICON, [
    '...BBB..',
    '..B...S.',
    '.B....S.',
    '.B....S.',
    '.B....S.',
    '.B....S.',
    '..B...S.',
    '...BBB..',
  ], { B: rgb([130, 96, 52]), S: '#e8e8e8' })

  deco(T.MEAT_ICON, [
    '........',
    '..RRRR..',
    '.RRPPRR.',
    '.RPPPPR.',
    '.RRPPRR.',
    '..RRRR..',
    '...WW...',
    '........',
  ], { R: rgb([196, 72, 64]), P: rgb([232, 150, 140]), W: '#f2ede4' })

  deco(T.ARROW_ICON, [
    '.......G',
    '......GG',
    '.....S..',
    '....S...',
    '...S....',
    '..S.....',
    '.FF.....',
    'F.F.....',
  ], { G: rgb([170, 170, 176]), S: rgb([130, 96, 52]), F: '#e8e8e8' })

  deco(T.HEART_FULL, [
    '.RR..RR.',
    'RRRRRRRR',
    'RRRRRRRR',
    'RRRRRRRR',
    '.RRRRRR.',
    '..RRRR..',
    '...RR...',
    '........',
  ], { R: rgb([228, 46, 46]) })

  deco(T.HEART_EMPTY, [
    '.DD..DD.',
    'DDDDDDDD',
    'DDDDDDDD',
    'DDDDDDDD',
    '.DDDDDD.',
    '..DDDD..',
    '...DD...',
    '........',
  ], { D: rgb([58, 58, 62]) })

  const btx = T.BEDROCK % ATLAS_GRID
  const bty = Math.floor(T.BEDROCK / ATLAS_GRID)
  noiseTile(ctx, btx, bty, [60, 60, 60], 25, rng)
}

/** Build the full procedural atlas once at startup. */
export function buildAtlas(seed = 1337): AtlasResult {
  const canvas = document.createElement('canvas')
  canvas.width = ATLAS_PX
  canvas.height = ATLAS_PX
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas context unavailable')
  ctx.imageSmoothingEnabled = false

  const rng = mulberry32(seed)
  drawTerrainTiles(ctx, rng)
  drawDecoAndIconTiles(ctx, rng)
  drawMobSkinTiles(ctx, rng)

  const texture = new THREE.CanvasTexture(canvas)
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  texture.generateMipmaps = false
  texture.colorSpace = THREE.SRGBColorSpace
  return { texture, canvas }
}
