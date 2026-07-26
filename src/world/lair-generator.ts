import { distance2D } from '../core/math-utils'
import { Block } from './block-registry'
import { CHUNK_SIZE, Chunk, WORLD_HEIGHT } from './chunk'

export const LAIR_CENTER_X = 256
export const LAIR_CENTER_Z = 256
export const LAIR_RADIUS = 36
/** Flat obsidian arena floor height. */
export const ARENA_Y = 34
const TOWER_HEIGHT = 12
const TOWER_RING_RADIUS = 22

export interface TowerSpot {
  x: number
  z: number
  /** Y of the glowstone cap; the crystal floats above it. */
  topY: number
}

/** The four crystal towers at the cardinal points of the arena. */
export function lairTowerSpots(): TowerSpot[] {
  const spots: TowerSpot[] = []
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    spots.push({
      x: LAIR_CENTER_X + dx * TOWER_RING_RADIUS,
      z: LAIR_CENTER_Z + dz * TOWER_RING_RADIUS,
      topY: ARENA_Y + TOWER_HEIGHT + 1,
    })
  }
  return spots
}

export function isNearLair(wx: number, wz: number, margin = 0): boolean {
  return distance2D(wx, wz, LAIR_CENTER_X, LAIR_CENTER_Z) < LAIR_RADIUS + margin
}

/**
 * Post-process a freshly generated chunk: carve the obsidian arena, rim wall,
 * perch mound and crystal towers into any chunk that intersects the lair.
 */
export function applyLairToChunk(chunk: Chunk): void {
  const baseX = chunk.cx * CHUNK_SIZE
  const baseZ = chunk.cz * CHUNK_SIZE

  // Quick reject: chunk square vs lair circle.
  const nearestX = Math.max(baseX, Math.min(LAIR_CENTER_X, baseX + CHUNK_SIZE))
  const nearestZ = Math.max(baseZ, Math.min(LAIR_CENTER_Z, baseZ + CHUNK_SIZE))
  if (distance2D(nearestX, nearestZ, LAIR_CENTER_X, LAIR_CENTER_Z) > LAIR_RADIUS + 1) return

  for (let x = 0; x < CHUNK_SIZE; x++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      const wx = baseX + x
      const wz = baseZ + z
      const d = distance2D(wx, wz, LAIR_CENTER_X, LAIR_CENTER_Z)
      if (d >= LAIR_RADIUS) continue

      chunk.set(x, 0, z, Block.BEDROCK)
      for (let y = 1; y <= ARENA_Y - 3; y++) chunk.set(x, y, z, Block.STONE)
      for (let y = ARENA_Y - 2; y <= ARENA_Y; y++) chunk.set(x, y, z, Block.OBSIDIAN)
      for (let y = ARENA_Y + 1; y < WORLD_HEIGHT; y++) chunk.set(x, y, z, Block.AIR)

      // Raised rim so the arena reads as a fortress from afar.
      if (d >= LAIR_RADIUS - 2) {
        chunk.set(x, ARENA_Y + 1, z, Block.OBSIDIAN)
        if (d >= LAIR_RADIUS - 1) chunk.set(x, ARENA_Y + 2, z, Block.OBSIDIAN)
      }

      // Central perch mound.
      if (d < 4) chunk.set(x, ARENA_Y + 1, z, Block.OBSIDIAN)
      if (d < 2.2) chunk.set(x, ARENA_Y + 2, z, Block.OBSIDIAN)

      // Crystal towers: 2×2 obsidian columns capped with glowstone.
      for (const spot of lairTowerSpots()) {
        if (wx >= spot.x && wx <= spot.x + 1 && wz >= spot.z && wz <= spot.z + 1) {
          for (let y = ARENA_Y + 1; y <= ARENA_Y + TOWER_HEIGHT; y++) {
            chunk.set(x, y, z, Block.OBSIDIAN)
          }
          chunk.set(x, ARENA_Y + TOWER_HEIGHT + 1, z, Block.GLOWSTONE)
        }
      }
    }
  }
}
