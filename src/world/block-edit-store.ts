import { Block } from './block-registry'
import { CHUNK_SIZE, WORLD_HEIGHT, type Chunk } from './chunk'

/** Beyond this many total edits the oldest-touched chunks are dropped. */
const MAX_EDITS = 50_000
const VOXELS_PER_CHUNK = CHUNK_SIZE * WORLD_HEIGHT * CHUNK_SIZE
const MAX_BLOCK_ID = Block.BEDROCK

/**
 * Diff of player block edits over generated terrain, keyed by chunk. Chunks
 * re-apply their diff after regeneration, so builds survive walking away.
 * Serialized to localStorage (per world seed) so they survive reloads too.
 */
export class BlockEditStore {
  private readonly edits = new Map<string, Map<number, number>>()
  private total = 0
  private saveTimer: number | null = null

  constructor(private readonly storageKey: string) {}

  private static voxelIndex(lx: number, y: number, lz: number): number {
    return (y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx
  }

  /** Record a player edit in chunk-local coordinates. */
  record(chunkKey: string, lx: number, y: number, lz: number, id: number): void {
    let chunkEdits = this.edits.get(chunkKey)
    if (!chunkEdits) {
      chunkEdits = new Map()
      this.edits.set(chunkKey, chunkEdits)
    }
    const index = BlockEditStore.voxelIndex(lx, y, lz)
    if (!chunkEdits.has(index)) this.total++
    chunkEdits.set(index, id)
    // Move to the back of the map so eviction drops the least-recently
    // touched chunk first.
    this.edits.delete(chunkKey)
    this.edits.set(chunkKey, chunkEdits)
    this.evictIfNeeded()
    this.scheduleSave()
  }

  /** Re-apply stored edits to freshly generated chunk data. */
  applyTo(chunk: Chunk): void {
    const chunkEdits = this.edits.get(`${chunk.cx},${chunk.cz}`)
    if (!chunkEdits) return
    for (const [index, id] of chunkEdits) {
      chunk.blocks[index] = id
    }
  }

  private evictIfNeeded(): void {
    while (this.total > MAX_EDITS) {
      const oldest = this.edits.keys().next()
      if (oldest.done) return
      const dropped = this.edits.get(oldest.value)
      this.total -= dropped?.size ?? 0
      this.edits.delete(oldest.value)
    }
  }

  private scheduleSave(): void {
    if (this.saveTimer !== null) return
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = null
      this.save()
    }, 3000)
  }

  save(): void {
    try {
      const payload: Array<[string, Array<[number, number]>]> = []
      for (const [key, chunkEdits] of this.edits) {
        payload.push([key, [...chunkEdits.entries()]])
      }
      localStorage.setItem(this.storageKey, JSON.stringify(payload))
    } catch {
      // Quota or privacy mode: persistence is best-effort only.
    }
  }

  load(): void {
    try {
      const raw = localStorage.getItem(this.storageKey)
      if (!raw) return
      const payload = JSON.parse(raw) as Array<[string, Array<[number, number]>]>
      this.edits.clear()
      this.total = 0
      for (const [key, entries] of payload) {
        const chunkEdits = new Map<number, number>()
        for (const [index, id] of entries) {
          // Corrupt entries must not smuggle out-of-range voxels or ids in.
          if (
            Number.isInteger(index) && index >= 0 && index < VOXELS_PER_CHUNK &&
            Number.isInteger(id) && id >= 0 && id <= MAX_BLOCK_ID
          ) {
            chunkEdits.set(index, id)
          }
        }
        this.edits.set(key, chunkEdits)
        this.total += chunkEdits.size
      }
    } catch {
      // Corrupt storage: start from a clean slate rather than crash.
      this.edits.clear()
      this.total = 0
    }
  }
}
