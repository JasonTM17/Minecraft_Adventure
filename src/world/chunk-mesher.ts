import * as THREE from 'three'
import { Block, blockDef } from './block-registry'
import { CHUNK_SIZE, Chunk, WORLD_HEIGHT } from './chunk'
import { tileUV } from './texture-atlas'

/** Anything that can answer world-space block queries (the World). */
export interface VoxelSource {
  getBlock(wx: number, wy: number, wz: number): number
}

interface FaceCorner {
  pos: readonly [number, number, number]
  uv: readonly [number, number]
}

interface FaceDef {
  dir: readonly [number, number, number]
  brightness: number
  corners: readonly [FaceCorner, FaceCorner, FaceCorner, FaceCorner]
}

const FACES: readonly FaceDef[] = [
  {
    dir: [-1, 0, 0],
    brightness: 0.7,
    corners: [
      { pos: [0, 1, 0], uv: [0, 1] },
      { pos: [0, 0, 0], uv: [0, 0] },
      { pos: [0, 1, 1], uv: [1, 1] },
      { pos: [0, 0, 1], uv: [1, 0] },
    ],
  },
  {
    dir: [1, 0, 0],
    brightness: 0.7,
    corners: [
      { pos: [1, 1, 1], uv: [0, 1] },
      { pos: [1, 0, 1], uv: [0, 0] },
      { pos: [1, 1, 0], uv: [1, 1] },
      { pos: [1, 0, 0], uv: [1, 0] },
    ],
  },
  {
    dir: [0, -1, 0],
    brightness: 0.55,
    corners: [
      { pos: [1, 0, 1], uv: [1, 0] },
      { pos: [0, 0, 1], uv: [0, 0] },
      { pos: [1, 0, 0], uv: [1, 1] },
      { pos: [0, 0, 0], uv: [0, 1] },
    ],
  },
  {
    dir: [0, 1, 0],
    brightness: 1.0,
    corners: [
      { pos: [0, 1, 1], uv: [1, 1] },
      { pos: [1, 1, 1], uv: [0, 1] },
      { pos: [0, 1, 0], uv: [1, 0] },
      { pos: [1, 1, 0], uv: [0, 0] },
    ],
  },
  {
    dir: [0, 0, -1],
    brightness: 0.82,
    corners: [
      { pos: [1, 0, 0], uv: [0, 0] },
      { pos: [0, 0, 0], uv: [1, 0] },
      { pos: [1, 1, 0], uv: [0, 1] },
      { pos: [0, 1, 0], uv: [1, 1] },
    ],
  },
  {
    dir: [0, 0, 1],
    brightness: 0.82,
    corners: [
      { pos: [0, 0, 1], uv: [0, 0] },
      { pos: [1, 0, 1], uv: [1, 0] },
      { pos: [0, 1, 1], uv: [0, 1] },
      { pos: [1, 1, 1], uv: [1, 1] },
    ],
  },
]

const AO_LEVELS = [0.45, 0.65, 0.82, 1.0] as const

class GeometryBuffers {
  readonly positions: number[] = []
  readonly normals: number[] = []
  readonly colors: number[] = []
  readonly uvs: number[] = []
  readonly indices: number[] = []
  private vertexCount = 0

  pushVertex(
    x: number,
    y: number,
    z: number,
    nx: number,
    ny: number,
    nz: number,
    shade: number,
    u: number,
    v: number,
  ): void {
    this.positions.push(x, y, z)
    this.normals.push(nx, ny, nz)
    this.colors.push(shade, shade, shade)
    this.uvs.push(u, v)
  }

  endQuad(): void {
    const b = this.vertexCount
    this.indices.push(b, b + 1, b + 2, b + 2, b + 1, b + 3)
    this.vertexCount += 4
  }

  build(): THREE.BufferGeometry | null {
    if (this.indices.length === 0) return null
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3))
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3))
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2))
    geometry.setIndex(this.indices)
    geometry.computeBoundingSphere()
    return geometry
  }
}

function occludesAt(source: VoxelSource, x: number, y: number, z: number): boolean {
  return blockDef(source.getBlock(x, y, z)).occludes
}

/** Classic 3-sample vertex ambient occlusion for one face corner. */
function vertexAO(
  source: VoxelSource,
  nx: number,
  ny: number,
  nz: number,
  dir: readonly [number, number, number],
  corner: readonly [number, number, number],
): number {
  let ux = 0
  let uy = 0
  let uz = 0
  let vx = 0
  let vy = 0
  let vz = 0
  let su: number
  let sv: number
  if (dir[0] !== 0) {
    uy = 1
    vz = 1
    su = corner[1] === 1 ? 1 : -1
    sv = corner[2] === 1 ? 1 : -1
  } else if (dir[1] !== 0) {
    ux = 1
    vz = 1
    su = corner[0] === 1 ? 1 : -1
    sv = corner[2] === 1 ? 1 : -1
  } else {
    ux = 1
    vy = 1
    su = corner[0] === 1 ? 1 : -1
    sv = corner[1] === 1 ? 1 : -1
  }
  const s1 = occludesAt(source, nx + ux * su, ny + uy * su, nz + uz * su)
  const s2 = occludesAt(source, nx + vx * sv, ny + vy * sv, nz + vz * sv)
  const c = occludesAt(source, nx + ux * su + vx * sv, ny + uy * su + vy * sv, nz + uz * su + vz * sv)
  const level = s1 && s2 ? 0 : 3 - ((s1 ? 1 : 0) + (s2 ? 1 : 0) + (c ? 1 : 0))
  return AO_LEVELS[level] as number
}

function emitCross(buffers: GeometryBuffers, x: number, y: number, z: number, tile: number): void {
  const [u0, v0, u1, v1] = tileUV(tile)
  const planes: ReadonlyArray<ReadonlyArray<readonly [number, number, number]>> = [
    [[0, 0, 0], [1, 0, 1], [0, 1, 0], [1, 1, 1]],
    [[1, 0, 0], [0, 0, 1], [1, 1, 0], [0, 1, 1]],
  ]
  for (const plane of planes) {
    const uvs: ReadonlyArray<readonly [number, number]> = [[u0, v0], [u1, v0], [u0, v1], [u1, v1]]
    for (let i = 0; i < 4; i++) {
      const p = plane[i] as readonly [number, number, number]
      const uv = uvs[i] as readonly [number, number]
      buffers.pushVertex(x + p[0], y + p[1], z + p[2], 0, 1, 0, 1, uv[0], uv[1])
    }
    buffers.endQuad()
  }
}

export interface ChunkGeometries {
  opaque: THREE.BufferGeometry | null
  cutout: THREE.BufferGeometry | null
  water: THREE.BufferGeometry | null
}

/** Build render geometry for one chunk. Positions are chunk-local. */
export function buildChunkGeometry(source: VoxelSource, chunk: Chunk): ChunkGeometries {
  const opaque = new GeometryBuffers()
  const cutout = new GeometryBuffers()
  const water = new GeometryBuffers()
  const baseX = chunk.cx * CHUNK_SIZE
  const baseZ = chunk.cz * CHUNK_SIZE

  for (let y = 0; y < WORLD_HEIGHT; y++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const id = chunk.get(x, y, z)
        if (id === Block.AIR) continue
        const def = blockDef(id)
        const faces = def.faces
        if (!faces) continue

        if (def.cross) {
          emitCross(cutout, x, y, z, faces.side)
          continue
        }

        const wx = baseX + x
        const wz = baseZ + z
        const isWater = def.fluid === true
        const isLeaves = id === Block.LEAVES
        const target = isWater ? water : isLeaves ? cutout : opaque

        for (const face of FACES) {
          const [dx, dy, dz] = face.dir
          const neighbor = source.getBlock(wx + dx, y + dy, wz + dz)
          if (blockDef(neighbor).occludes) continue
          if (neighbor === id && (isWater || isLeaves)) continue

          const tile = dy > 0 ? faces.top : dy < 0 ? faces.bottom : faces.side
          const [u0, v0, u1, v1] = tileUV(tile)

          for (const corner of face.corners) {
            const ao = isWater
              ? 1
              : vertexAO(source, wx + dx, y + dy, wz + dz, face.dir, corner.pos)
            const shade = face.brightness * ao
            const u = corner.uv[0] === 0 ? u0 : u1
            const v = corner.uv[1] === 0 ? v0 : v1
            target.pushVertex(
              x + corner.pos[0],
              y + corner.pos[1],
              z + corner.pos[2],
              dx,
              dy,
              dz,
              shade,
              u,
              v,
            )
          }
          target.endQuad()
        }
      }
    }
  }

  return { opaque: opaque.build(), cutout: cutout.build(), water: water.build() }
}
