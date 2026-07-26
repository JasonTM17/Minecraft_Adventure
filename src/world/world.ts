import * as THREE from 'three'
import { Block, blockDef, isSolid } from './block-registry'
import { CHUNK_SIZE, Chunk, WORLD_HEIGHT } from './chunk'
import { buildChunkGeometry, type VoxelSource } from './chunk-mesher'
import { SEA_LEVEL, TerrainGenerator } from './terrain-generator'
import type { AtlasResult } from './texture-atlas'

/** Chunk radius that gets meshed and rendered around the player. */
export const VIEW_DISTANCE = 6
const DATA_MARGIN = 1
const UNLOAD_DISTANCE = VIEW_DISTANCE + 2
const GEN_BUDGET_PER_FRAME = 3
const MESH_BUDGET_PER_FRAME = 2

/**
 * Streaming chunk manager: generates voxel data in a ring around the player,
 * meshes dirty chunks on a per-frame budget and unloads far chunks.
 */
export class World implements VoxelSource {
  readonly group = new THREE.Group()
  private readonly chunks = new Map<string, Chunk>()
  private readonly opaqueMaterial: THREE.MeshLambertMaterial
  private readonly cutoutMaterial: THREE.MeshLambertMaterial
  private readonly waterMaterial: THREE.MeshLambertMaterial
  /** Hook for structure generators (dragon lair) to post-process chunk data. */
  onChunkGenerated: ((chunk: Chunk) => void) | null = null

  constructor(
    scene: THREE.Scene,
    readonly terrain: TerrainGenerator,
    atlas: AtlasResult,
  ) {
    this.opaqueMaterial = new THREE.MeshLambertMaterial({ map: atlas.texture, vertexColors: true })
    this.cutoutMaterial = new THREE.MeshLambertMaterial({
      map: atlas.texture,
      vertexColors: true,
      alphaTest: 0.45,
      side: THREE.DoubleSide,
    })
    this.waterMaterial = new THREE.MeshLambertMaterial({
      map: atlas.texture,
      vertexColors: true,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    })
    scene.add(this.group)
  }

  getBlock(wx: number, wy: number, wz: number): number {
    if (wy < 0) return Block.BEDROCK
    if (wy >= WORLD_HEIGHT) return Block.AIR
    const fx = Math.floor(wx)
    const fz = Math.floor(wz)
    const cx = Math.floor(fx / CHUNK_SIZE)
    const cz = Math.floor(fz / CHUNK_SIZE)
    const chunk = this.chunks.get(Chunk.key(cx, cz))
    // Ungenerated area reads as stone so border faces stay hidden and
    // physics cannot walk into the void.
    if (!chunk || !chunk.generated) return Block.STONE
    return chunk.get(fx - cx * CHUNK_SIZE, Math.floor(wy), fz - cz * CHUNK_SIZE)
  }

  /** Place/remove a block. Returns false when the chunk is not loaded. */
  setBlock(wx: number, wy: number, wz: number, id: number): boolean {
    if (wy < 0 || wy >= WORLD_HEIGHT) return false
    const cx = Math.floor(wx / CHUNK_SIZE)
    const cz = Math.floor(wz / CHUNK_SIZE)
    const chunk = this.chunks.get(Chunk.key(cx, cz))
    if (!chunk || !chunk.generated) return false
    const lx = wx - cx * CHUNK_SIZE
    const lz = wz - cz * CHUNK_SIZE
    chunk.set(lx, wy, lz, id)
    chunk.dirty = true
    if (lx === 0) this.markDirty(cx - 1, cz)
    if (lx === CHUNK_SIZE - 1) this.markDirty(cx + 1, cz)
    if (lz === 0) this.markDirty(cx, cz - 1)
    if (lz === CHUNK_SIZE - 1) this.markDirty(cx, cz + 1)
    return true
  }

  private markDirty(cx: number, cz: number): void {
    const chunk = this.chunks.get(Chunk.key(cx, cz))
    if (chunk) chunk.dirty = true
  }

  /** Highest solid block at a column, for spawning things on the surface. */
  surfaceY(wx: number, wz: number): number {
    for (let y = WORLD_HEIGHT - 1; y > 0; y--) {
      if (isSolid(this.getBlock(wx, y, wz))) return y
    }
    return SEA_LEVEL
  }

  /** True when the column's surface is dry walkable ground (not water). */
  isDryLand(wx: number, wz: number): boolean {
    const y = this.surfaceY(wx, wz)
    return y > SEA_LEVEL && !blockDef(this.getBlock(wx, y, wz)).fluid
  }

  /** Stream chunks around the given world position. Call once per frame. */
  update(px: number, pz: number): void {
    const ccx = Math.floor(px / CHUNK_SIZE)
    const ccz = Math.floor(pz / CHUNK_SIZE)

    this.generateMissing(ccx, ccz)
    this.remeshDirty(ccx, ccz)
    this.unloadFar(ccx, ccz)
  }

  /** Synchronously generate + mesh everything around a position (world start). */
  preload(px: number, pz: number): void {
    const ccx = Math.floor(px / CHUNK_SIZE)
    const ccz = Math.floor(pz / CHUNK_SIZE)
    for (let i = 0; i < 500; i++) {
      const generated = this.generateMissing(ccx, ccz, 64)
      const meshed = this.remeshDirty(ccx, ccz, 64)
      if (!generated && !meshed) break
    }
  }

  private generateMissing(ccx: number, ccz: number, budget = GEN_BUDGET_PER_FRAME): boolean {
    const radius = VIEW_DISTANCE + DATA_MARGIN
    const missing: Array<{ cx: number; cz: number; d: number }> = []
    for (let cx = ccx - radius; cx <= ccx + radius; cx++) {
      for (let cz = ccz - radius; cz <= ccz + radius; cz++) {
        if (!this.chunks.has(Chunk.key(cx, cz))) {
          const d = Math.max(Math.abs(cx - ccx), Math.abs(cz - ccz))
          missing.push({ cx, cz, d })
        }
      }
    }
    if (missing.length === 0) return false
    missing.sort((a, b) => a.d - b.d)
    for (const m of missing.slice(0, budget)) {
      const chunk = new Chunk(m.cx, m.cz)
      this.terrain.fillChunk(chunk)
      this.onChunkGenerated?.(chunk)
      this.chunks.set(Chunk.key(m.cx, m.cz), chunk)
      // Freshly generated data affects neighbor border faces.
      this.markDirty(m.cx - 1, m.cz)
      this.markDirty(m.cx + 1, m.cz)
      this.markDirty(m.cx, m.cz - 1)
      this.markDirty(m.cx, m.cz + 1)
    }
    return true
  }

  private neighborsGenerated(cx: number, cz: number): boolean {
    return (
      (this.chunks.get(Chunk.key(cx - 1, cz))?.generated ?? false) &&
      (this.chunks.get(Chunk.key(cx + 1, cz))?.generated ?? false) &&
      (this.chunks.get(Chunk.key(cx, cz - 1))?.generated ?? false) &&
      (this.chunks.get(Chunk.key(cx, cz + 1))?.generated ?? false)
    )
  }

  private remeshDirty(ccx: number, ccz: number, budget = MESH_BUDGET_PER_FRAME): boolean {
    const dirty: Array<{ chunk: Chunk; d: number }> = []
    for (const chunk of this.chunks.values()) {
      if (!chunk.dirty) continue
      const d = Math.max(Math.abs(chunk.cx - ccx), Math.abs(chunk.cz - ccz))
      if (d > VIEW_DISTANCE) continue
      if (!this.neighborsGenerated(chunk.cx, chunk.cz)) continue
      dirty.push({ chunk, d })
    }
    if (dirty.length === 0) return false
    dirty.sort((a, b) => a.d - b.d)
    for (const entry of dirty.slice(0, budget)) this.rebuildChunk(entry.chunk)
    return true
  }

  private rebuildChunk(chunk: Chunk): void {
    this.disposeMeshes(chunk)
    const geometries = buildChunkGeometry(this, chunk)
    const baseX = chunk.cx * CHUNK_SIZE
    const baseZ = chunk.cz * CHUNK_SIZE
    if (geometries.opaque) {
      chunk.opaqueMesh = new THREE.Mesh(geometries.opaque, this.opaqueMaterial)
    }
    if (geometries.cutout) {
      chunk.cutoutMesh = new THREE.Mesh(geometries.cutout, this.cutoutMaterial)
    }
    if (geometries.water) {
      chunk.waterMesh = new THREE.Mesh(geometries.water, this.waterMaterial)
    }
    for (const mesh of [chunk.opaqueMesh, chunk.cutoutMesh, chunk.waterMesh]) {
      if (!mesh) continue
      mesh.position.set(baseX, 0, baseZ)
      this.group.add(mesh)
    }
    chunk.dirty = false
  }

  private disposeMeshes(chunk: Chunk): void {
    for (const mesh of [chunk.opaqueMesh, chunk.cutoutMesh, chunk.waterMesh]) {
      if (!mesh) continue
      this.group.remove(mesh)
      mesh.geometry.dispose()
    }
    chunk.opaqueMesh = null
    chunk.cutoutMesh = null
    chunk.waterMesh = null
  }

  private unloadFar(ccx: number, ccz: number): void {
    for (const [key, chunk] of this.chunks) {
      const d = Math.max(Math.abs(chunk.cx - ccx), Math.abs(chunk.cz - ccz))
      if (d <= UNLOAD_DISTANCE) continue
      this.disposeMeshes(chunk)
      this.chunks.delete(key)
    }
  }
}
