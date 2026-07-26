import { drawPattern, noiseTile, pxRect, rgb } from './texture-tile-helpers'

/** Atlas tile indices for creature skins (row 1 of the atlas grid). */
export const MOB_TILES = {
  PIG_SKIN: 16,
  PIG_FACE: 17,
  COW_SKIN: 18,
  COW_FACE: 19,
  SHEEP_WOOL: 20,
  SHEEP_FACE: 21,
  CHICKEN_SKIN: 22,
  CHICKEN_FACE: 23,
  ZOMBIE_SKIN: 24,
  ZOMBIE_FACE: 25,
  SKELETON_SKIN: 26,
  SKELETON_FACE: 27,
  DRAGON_SCALE: 28,
  DRAGON_FACE: 29,
  DRAGON_WING: 30,
  DRAGON_BELLY: 31,
} as const

const tx = (i: number) => i % 16
const ty = (i: number) => Math.floor(i / 16)

function skin(ctx: CanvasRenderingContext2D, i: number, base: readonly [number, number, number], jitter: number, rng: () => number): void {
  noiseTile(ctx, tx(i), ty(i), base, jitter, rng)
}

export function drawMobSkinTiles(ctx: CanvasRenderingContext2D, rng: () => number): void {
  const M = MOB_TILES

  skin(ctx, M.PIG_SKIN, [238, 164, 172], 10, rng)
  skin(ctx, M.PIG_FACE, [238, 164, 172], 10, rng)
  drawPattern(ctx, tx(M.PIG_FACE), ty(M.PIG_FACE), [
    '........',
    '.W....W.',
    '.B....B.',
    '........',
    '..PPPP..',
    '..PNNP..',
    '..PPPP..',
    '........',
  ], { W: '#ffffff', B: '#1a1a1a', P: rgb([214, 128, 138]), N: '#5c2430' }, 2)

  skin(ctx, M.COW_SKIN, [92, 64, 48], 10, rng)
  for (let i = 0; i < 3; i++) {
    pxRect(ctx, tx(M.COW_SKIN), ty(M.COW_SKIN), (rng() * 11) | 0, (rng() * 11) | 0, 3 + ((rng() * 3) | 0), 3 + ((rng() * 3) | 0), rgb([222, 218, 210]))
  }
  skin(ctx, M.COW_FACE, [92, 64, 48], 10, rng)
  drawPattern(ctx, tx(M.COW_FACE), ty(M.COW_FACE), [
    '........',
    '.W....W.',
    '.B....B.',
    '........',
    '.MMMMMM.',
    '.MN..NM.',
    '.MMMMMM.',
    '........',
  ], { W: '#ffffff', B: '#1a1a1a', M: rgb([199, 178, 152]), N: '#3a2418' }, 2)

  skin(ctx, M.SHEEP_WOOL, [228, 228, 228], 14, rng)
  skin(ctx, M.SHEEP_FACE, [228, 228, 228], 14, rng)
  drawPattern(ctx, tx(M.SHEEP_FACE), ty(M.SHEEP_FACE), [
    '..TTTT..',
    '.TTTTTT.',
    '.TW..WT.',
    '.TB..BT.',
    '.TTTTTT.',
    '.TTNNTT.',
    '..TTTT..',
    '........',
  ], { T: rgb([225, 200, 176]), W: '#ffffff', B: '#1a1a1a', N: '#8a6a52' }, 2)

  skin(ctx, M.CHICKEN_SKIN, [242, 240, 235], 8, rng)
  skin(ctx, M.CHICKEN_FACE, [242, 240, 235], 8, rng)
  drawPattern(ctx, tx(M.CHICKEN_FACE), ty(M.CHICKEN_FACE), [
    '........',
    '.W....W.',
    '.B....B.',
    '...OO...',
    '..OOOO..',
    '...RR...',
    '........',
    '........',
  ], { W: '#ffffff', B: '#1a1a1a', O: rgb([236, 148, 40]), R: rgb([200, 44, 44]) }, 2)

  skin(ctx, M.ZOMBIE_SKIN, [88, 132, 72], 14, rng)
  skin(ctx, M.ZOMBIE_FACE, [88, 132, 72], 14, rng)
  drawPattern(ctx, tx(M.ZOMBIE_FACE), ty(M.ZOMBIE_FACE), [
    '........',
    '.BB..BB.',
    '.BB..BB.',
    '........',
    '..D..D..',
    '..DDDD..',
    '........',
    '........',
  ], { B: '#101418', D: rgb([46, 70, 38]) }, 2)

  skin(ctx, M.SKELETON_SKIN, [196, 196, 188], 8, rng)
  skin(ctx, M.SKELETON_FACE, [196, 196, 188], 8, rng)
  drawPattern(ctx, tx(M.SKELETON_FACE), ty(M.SKELETON_FACE), [
    '........',
    '.DD..DD.',
    '.DD..DD.',
    '...DD...',
    '........',
    '.D.DD.D.',
    '.DDDDDD.',
    '........',
  ], { D: '#2a2a28' }, 2)

  skin(ctx, M.DRAGON_SCALE, [30, 26, 40], 8, rng)
  for (let i = 0; i < 12; i++) {
    pxRect(ctx, tx(M.DRAGON_SCALE), ty(M.DRAGON_SCALE), (rng() * 14) | 0, (rng() * 14) | 0, 2, 1, rgb([18, 15, 26]))
  }
  skin(ctx, M.DRAGON_FACE, [30, 26, 40], 8, rng)
  drawPattern(ctx, tx(M.DRAGON_FACE), ty(M.DRAGON_FACE), [
    'H......H',
    'HH....HH',
    '........',
    '.OO..OO.',
    '.OS..SO.',
    '........',
    '..N..N..',
    '........',
  ], { H: rgb([120, 116, 128]), O: rgb([240, 120, 30]), S: '#100c14', N: '#0c0a10' }, 2)

  skin(ctx, M.DRAGON_WING, [52, 40, 66], 8, rng)
  for (let i = 0; i < 4; i++) {
    pxRect(ctx, tx(M.DRAGON_WING), ty(M.DRAGON_WING), 2 + i * 4, 1, 1, 14, rgb([72, 58, 90]))
  }
  skin(ctx, M.DRAGON_BELLY, [96, 86, 110], 8, rng)
  for (let y = 2; y < 16; y += 4) {
    pxRect(ctx, tx(M.DRAGON_BELLY), ty(M.DRAGON_BELLY), 0, y, 16, 1, rgb([70, 62, 84]))
  }
}
