import type * as THREE from 'three'
import { Block } from './block-registry'

export const CHUNK_SIZE = 16
export const WORLD_HEIGHT = 96

/** One 16×96×16 column of voxels plus its render meshes. */
export class Chunk {
  readonly blocks = new Uint8Array(CHUNK_SIZE * WORLD_HEIGHT * CHUNK_SIZE)
  /** Needs remesh. Set on edits and on creation. */
  dirty = true
  /** True once terrain generation filled the voxel data. */
  generated = false
  opaqueMesh: THREE.Mesh | null = null
  cutoutMesh: THREE.Mesh | null = null
  waterMesh: THREE.Mesh | null = null

  constructor(
    readonly cx: number,
    readonly cz: number,
  ) {}

  static key(cx: number, cz: number): string {
    return `${cx},${cz}`
  }

  private index(x: number, y: number, z: number): number {
    return (y * CHUNK_SIZE + z) * CHUNK_SIZE + x
  }

  /** Local coordinates. Out-of-range y reads as air (above) / bedrock (below). */
  get(x: number, y: number, z: number): number {
    if (y < 0) return Block.BEDROCK
    if (y >= WORLD_HEIGHT) return Block.AIR
    return this.blocks[this.index(x, y, z)] as number
  }

  set(x: number, y: number, z: number, id: number): void {
    if (y < 0 || y >= WORLD_HEIGHT) return
    this.blocks[this.index(x, y, z)] = id
  }
}
