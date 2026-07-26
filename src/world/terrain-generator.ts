import { hash2i } from '../core/math-utils'
import { Block } from './block-registry'
import { CHUNK_SIZE, Chunk } from './chunk'
import { fbm2 } from './noise'

export const SEA_LEVEL = 28
export type Biome = 'plains' | 'forest' | 'desert' | 'snow'

interface TreeInfo {
  trunkHeight: number
  groundY: number
}

/**
 * Deterministic terrain: same seed + coordinates always produce the same world.
 * Trees are computed per-column with a margin so canopies span chunk borders.
 */
export class TerrainGenerator {
  constructor(readonly seed: number) {}

  heightAt(wx: number, wz: number): number {
    const continent = fbm2(wx * 0.0045, wz * 0.0045, this.seed, 4)
    const detail = fbm2(wx * 0.02, wz * 0.02, this.seed + 7, 3)
    const ridged = fbm2(wx * 0.008, wz * 0.008, this.seed + 91, 3)
    const mountains = Math.pow(ridged, 2.5) * 30
    return Math.floor(18 + continent * 30 + detail * 6 + mountains)
  }

  biomeAt(wx: number, wz: number): Biome {
    const temp = fbm2(wx * 0.0025, wz * 0.0025, this.seed + 13, 3)
    const moist = fbm2(wx * 0.0025, wz * 0.0025, this.seed + 29, 3)
    if (temp < 0.36) return 'snow'
    if (temp > 0.62 && moist < 0.42) return 'desert'
    if (moist > 0.52) return 'forest'
    return 'plains'
  }

  /** Tree at this world column, or null. Deterministic, biome-driven density. */
  private treeAt(wx: number, wz: number): TreeInfo | null {
    const groundY = this.heightAt(wx, wz)
    if (groundY <= SEA_LEVEL + 1) return null
    const biome = this.biomeAt(wx, wz)
    const density = biome === 'forest' ? 0.02 : biome === 'plains' ? 0.004 : biome === 'snow' ? 0.006 : 0
    if (density === 0) return null
    const roll = hash2i(wx, wz, this.seed + 51)
    if (roll >= density) return null
    const trunkHeight = 4 + Math.floor(hash2i(wx, wz, this.seed + 77) * 3)
    return { trunkHeight, groundY }
  }

  fillChunk(chunk: Chunk): void {
    const baseX = chunk.cx * CHUNK_SIZE
    const baseZ = chunk.cz * CHUNK_SIZE

    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const wx = baseX + x
        const wz = baseZ + z
        const h = this.heightAt(wx, wz)
        const biome = this.biomeAt(wx, wz)

        chunk.set(x, 0, z, Block.BEDROCK)
        for (let y = 1; y <= h - 4; y++) chunk.set(x, y, z, Block.STONE)

        const beach = h <= SEA_LEVEL + 1
        const underwater = h < SEA_LEVEL
        let filler: number = Block.DIRT
        let top: number = Block.GRASS
        if (biome === 'desert' || beach || underwater) {
          filler = Block.SAND
          top = Block.SAND
        } else if (biome === 'snow') {
          top = Block.SNOW
        }
        for (let y = Math.max(1, h - 3); y < h; y++) chunk.set(x, y, z, filler)
        if (h >= 1) chunk.set(x, h, z, top)

        for (let y = h + 1; y <= SEA_LEVEL; y++) chunk.set(x, y, z, Block.WATER)

        // Surface decorations on dry grass only.
        if (top === Block.GRASS) {
          const deco = hash2i(wx, wz, this.seed + 133)
          if (deco < 0.004) chunk.set(x, h + 1, z, Block.FLOWER_RED)
          else if (deco < 0.008) chunk.set(x, h + 1, z, Block.FLOWER_YELLOW)
          else if (deco < 0.06 && biome !== 'snow') chunk.set(x, h + 1, z, Block.TALL_GRASS)
        }
      }
    }

    this.placeTrees(chunk, baseX, baseZ)
    chunk.generated = true
  }

  /** Scan a margin beyond the chunk so neighbor trees drop their canopy in. */
  private placeTrees(chunk: Chunk, baseX: number, baseZ: number): void {
    const setLocal = (wx: number, y: number, wz: number, id: number, keepExisting: boolean) => {
      const lx = wx - baseX
      const lz = wz - baseZ
      if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE) return
      if (keepExisting && chunk.get(lx, y, lz) !== Block.AIR) return
      chunk.set(lx, y, lz, id)
    }

    for (let wx = baseX - 3; wx < baseX + CHUNK_SIZE + 3; wx++) {
      for (let wz = baseZ - 3; wz < baseZ + CHUNK_SIZE + 3; wz++) {
        const tree = this.treeAt(wx, wz)
        if (!tree) continue
        const topY = tree.groundY + tree.trunkHeight

        for (let y = tree.groundY + 1; y <= topY; y++) setLocal(wx, y, wz, Block.LOG, false)

        for (let y = topY - 1; y <= topY; y++) {
          for (let dx = -2; dx <= 2; dx++) {
            for (let dz = -2; dz <= 2; dz++) {
              if (dx === 0 && dz === 0) continue
              if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue
              setLocal(wx + dx, y, wz + dz, Block.LEAVES, true)
            }
          }
        }
        for (let dx = -1; dx <= 1; dx++) {
          for (let dz = -1; dz <= 1; dz++) {
            if (Math.abs(dx) === 1 && Math.abs(dz) === 1) continue
            setLocal(wx + dx, topY + 1, wz + dz, Block.LEAVES, true)
          }
        }
      }
    }
  }
}
