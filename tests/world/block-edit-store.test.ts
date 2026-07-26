import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Block } from '../../src/world/block-registry'
import { CHUNK_SIZE, Chunk, WORLD_HEIGHT } from '../../src/world/chunk'
import { BlockEditStore } from '../../src/world/block-edit-store'

/**
 * Vitest's node environment has no localStorage/window. BlockEditStore only
 * needs `getItem`/`setItem` and a `setTimeout` handle, so a minimal in-memory
 * stub is enough to exercise real save/load behavior without a browser.
 */
class MemoryStorage implements Storage {
  private readonly map = new Map<string, string>()

  get length(): number {
    return this.map.size
  }

  clear(): void {
    this.map.clear()
  }

  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null
  }

  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null
  }

  removeItem(key: string): void {
    this.map.delete(key)
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value)
  }
}

let originalLocalStorage: Storage | undefined
let originalWindow: typeof globalThis.window | undefined

beforeEach(() => {
  originalLocalStorage = (globalThis as { localStorage?: Storage }).localStorage
  originalWindow = globalThis.window
  ;(globalThis as { localStorage?: Storage }).localStorage = new MemoryStorage()
  // scheduleSave() only needs setTimeout; reuse Node's global timer.
  ;(globalThis as unknown as { window: { setTimeout: typeof setTimeout } }).window = {
    setTimeout: globalThis.setTimeout.bind(globalThis),
  }
})

afterEach(() => {
  if (originalLocalStorage === undefined) {
    delete (globalThis as { localStorage?: Storage }).localStorage
  } else {
    ;(globalThis as { localStorage?: Storage }).localStorage = originalLocalStorage
  }
  if (originalWindow === undefined) {
    delete (globalThis as { window?: unknown }).window
  } else {
    globalThis.window = originalWindow
  }
})

describe('BlockEditStore record/applyTo', () => {
  it('round-trips a recorded edit onto a real Chunk', () => {
    const store = new BlockEditStore('test-key')
    const chunk = new Chunk(2, -1)
    store.record(`${chunk.cx},${chunk.cz}`, 5, 10, 3, Block.GLOWSTONE)

    store.applyTo(chunk)

    expect(chunk.get(5, 10, 3)).toBe(Block.GLOWSTONE)
  })

  it('leaves untouched voxels as-is (defaults to AIR in a fresh chunk)', () => {
    const store = new BlockEditStore('test-key')
    const chunk = new Chunk(0, 0)
    store.record('0,0', 1, 1, 1, Block.STONE)

    store.applyTo(chunk)

    expect(chunk.get(1, 1, 1)).toBe(Block.STONE)
    expect(chunk.get(2, 2, 2)).toBe(Block.AIR)
  })

  it('does not apply edits recorded for a different chunk', () => {
    const store = new BlockEditStore('test-key')
    store.record('9,9', 0, 0, 0, Block.SAND)
    const chunk = new Chunk(0, 0)

    store.applyTo(chunk)

    expect(chunk.get(0, 0, 0)).toBe(Block.AIR)
  })
})

describe('BlockEditStore edit counting', () => {
  it('overwriting the same voxel does not double-count toward the total', () => {
    const store = new BlockEditStore('test-key')
    store.record('0,0', 1, 1, 1, Block.STONE)
    store.record('0,0', 1, 1, 1, Block.DIRT)
    store.record('0,0', 1, 1, 1, Block.SAND)

    store.save()
    const raw = (globalThis.localStorage as Storage).getItem('test-key')
    expect(raw).not.toBeNull()
    const payload = JSON.parse(raw as string) as Array<[string, Array<[number, number]>]>
    expect(payload).toHaveLength(1)
    expect(payload[0]?.[1]).toHaveLength(1)
    expect(payload[0]?.[1]?.[0]?.[1]).toBe(Block.SAND)

    const chunk = new Chunk(0, 0)
    store.applyTo(chunk)
    expect(chunk.get(1, 1, 1)).toBe(Block.SAND)
  })
})

describe('BlockEditStore save/load round-trip', () => {
  it('reloads recorded edits into a fresh store instance', () => {
    const writer = new BlockEditStore('round-trip-key')
    writer.record('1,1', 4, 8, 12, Block.OBSIDIAN)
    writer.record('1,1', 5, 9, 13, Block.CRYSTAL_BLOCK)
    writer.record('2,-3', 0, 0, 0, Block.LOG)
    writer.save()

    const reader = new BlockEditStore('round-trip-key')
    reader.load()

    const chunkA = new Chunk(1, 1)
    reader.applyTo(chunkA)
    expect(chunkA.get(4, 8, 12)).toBe(Block.OBSIDIAN)
    expect(chunkA.get(5, 9, 13)).toBe(Block.CRYSTAL_BLOCK)

    const chunkB = new Chunk(2, -3)
    reader.applyTo(chunkB)
    expect(chunkB.get(0, 0, 0)).toBe(Block.LOG)
  })

  it('load() is a no-op when nothing was ever saved under the key', () => {
    const store = new BlockEditStore('never-saved-key')
    expect(() => store.load()).not.toThrow()
    const chunk = new Chunk(0, 0)
    store.applyTo(chunk)
    expect(chunk.get(0, 0, 0)).toBe(Block.AIR)
  })
})

describe('BlockEditStore corrupt data rejection', () => {
  const voxelsPerChunk = CHUNK_SIZE * WORLD_HEIGHT * CHUNK_SIZE

  it('rejects entries with an out-of-range voxel index', () => {
    ;(globalThis.localStorage as Storage).setItem(
      'corrupt-index',
      JSON.stringify([
        ['0,0', [[-1, Block.STONE], [voxelsPerChunk, Block.STONE], [voxelsPerChunk + 100, Block.STONE]]],
      ]),
    )
    const store = new BlockEditStore('corrupt-index')
    store.load()

    const chunk = new Chunk(0, 0)
    store.applyTo(chunk)
    // Every voxel should remain untouched air since all entries were rejected.
    for (let i = 0; i < voxelsPerChunk; i += 4001) {
      expect(chunk.blocks[i]).toBe(Block.AIR)
    }
  })

  it('rejects entries with a non-integer index or id', () => {
    ;(globalThis.localStorage as Storage).setItem(
      'corrupt-non-integer',
      JSON.stringify([
        ['0,0', [[1.5, Block.STONE], [2, Block.STONE + 0.5]]],
      ]),
    )
    const store = new BlockEditStore('corrupt-non-integer')
    store.load()

    const chunk = new Chunk(0, 0)
    store.applyTo(chunk)
    expect(chunk.get(0, 0, 1)).toBe(Block.AIR)
    expect(chunk.get(0, 0, 2)).toBe(Block.AIR)
  })

  it('rejects entries with an id above BEDROCK (the max known block)', () => {
    ;(globalThis.localStorage as Storage).setItem(
      'corrupt-id',
      JSON.stringify([['0,0', [[3, Block.BEDROCK + 1], [4, 255]]]]),
    )
    const store = new BlockEditStore('corrupt-id')
    store.load()

    const chunk = new Chunk(0, 0)
    store.applyTo(chunk)
    expect(chunk.get(3, 0, 0)).toBe(Block.AIR)
    expect(chunk.get(4, 0, 0)).toBe(Block.AIR)
  })

  it('keeps valid entries alongside rejected ones in the same chunk', () => {
    ;(globalThis.localStorage as Storage).setItem(
      'mixed-validity',
      JSON.stringify([['0,0', [[-5, Block.STONE], [10, Block.GRASS], [99999, Block.SAND]]]]),
    )
    const store = new BlockEditStore('mixed-validity')
    store.load()

    const chunk = new Chunk(0, 0)
    store.applyTo(chunk)
    // index 10 => x=10, y=0, z=0 given voxelIndex = (y*16+z)*16+x
    expect(chunk.get(10, 0, 0)).toBe(Block.GRASS)
  })

  it('starts from a clean slate on malformed JSON instead of throwing', () => {
    ;(globalThis.localStorage as Storage).setItem('malformed-json', '{not valid json::')
    const store = new BlockEditStore('malformed-json')

    expect(() => store.load()).not.toThrow()

    const chunk = new Chunk(0, 0)
    store.applyTo(chunk)
    expect(chunk.get(0, 0, 0)).toBe(Block.AIR)
  })
})
