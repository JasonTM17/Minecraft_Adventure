import * as THREE from 'three'
import { T, tileUV } from '../world/texture-atlas'
import { lerp } from '../core/math-utils'

/** Renderable creature rig; group origin sits at the feet center, facing -Z. */
export interface MobModel {
  group: THREE.Group
  material: THREE.MeshLambertMaterial
  head: THREE.Object3D
  legs: THREE.Object3D[]
  arms?: THREE.Object3D[]
  /** Zombie-style forward arm pose. */
  armsRaised: boolean
}

interface FaceTiles {
  px: number
  nx: number
  py: number
  ny: number
  pz: number
  nz: number
}

function uniformTiles(tile: number, front?: number): FaceTiles {
  return { px: tile, nx: tile, py: tile, ny: tile, pz: tile, nz: front ?? tile }
}

/** BoxGeometry with each face UV-mapped onto an atlas tile. */
function tiledBox(w: number, h: number, d: number, tiles: FaceTiles): THREE.BoxGeometry {
  const geometry = new THREE.BoxGeometry(w, h, d)
  const uv = geometry.getAttribute('uv') as THREE.BufferAttribute
  const order = [tiles.px, tiles.nx, tiles.py, tiles.ny, tiles.pz, tiles.nz]
  for (let face = 0; face < 6; face++) {
    const [u0, v0, u1, v1] = tileUV(order[face] as number)
    for (let i = 0; i < 4; i++) {
      const idx = face * 4 + i
      uv.setXY(idx, lerp(u0, u1, uv.getX(idx)), lerp(v0, v1, uv.getY(idx)))
    }
  }
  return geometry
}

function part(
  material: THREE.MeshLambertMaterial,
  w: number,
  h: number,
  d: number,
  tiles: FaceTiles,
  x: number,
  y: number,
  z: number,
  pivotTop = false,
): THREE.Mesh {
  const geometry = tiledBox(w, h, d, tiles)
  if (pivotTop) geometry.translate(0, -h / 2, 0)
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(x, y, z)
  return mesh
}

interface QuadrupedSpec {
  bodyW: number
  bodyH: number
  bodyD: number
  legW: number
  legH: number
  headSize: number
  skin: number
  face: number
}

function quadruped(map: THREE.Texture, spec: QuadrupedSpec): MobModel {
  const material = new THREE.MeshLambertMaterial({ map })
  const group = new THREE.Group()
  const skin = uniformTiles(spec.skin)

  const bodyY = spec.legH + spec.bodyH / 2
  group.add(part(material, spec.bodyW, spec.bodyH, spec.bodyD, skin, 0, bodyY, 0))

  const hs = spec.headSize
  const head = part(
    material,
    hs,
    hs,
    hs,
    uniformTiles(spec.skin, spec.face),
    0,
    spec.legH + spec.bodyH * 0.85,
    -spec.bodyD / 2 - hs / 2 + 0.08,
  )
  group.add(head)

  const legs: THREE.Object3D[] = []
  const lx = spec.bodyW / 2 - spec.legW / 2
  const lz = spec.bodyD / 2 - spec.legW / 2
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const leg = part(
      material,
      spec.legW,
      spec.legH + 0.05,
      spec.legW,
      skin,
      sx * lx,
      spec.legH + 0.02,
      sz * lz,
      true,
    )
    legs.push(leg)
    group.add(leg)
  }
  return { group, material, head, legs, armsRaised: false }
}

interface HumanoidSpec {
  skin: number
  face: number
  armsRaised: boolean
}

function humanoid(map: THREE.Texture, spec: HumanoidSpec): MobModel {
  const material = new THREE.MeshLambertMaterial({ map })
  const group = new THREE.Group()
  const skin = uniformTiles(spec.skin)
  const legH = 0.75
  const bodyH = 0.7
  const bodyW = 0.52
  const bodyD = 0.28

  group.add(part(material, bodyW, bodyH, bodyD, skin, 0, legH + bodyH / 2, 0))

  const head = part(
    material,
    0.5,
    0.5,
    0.5,
    uniformTiles(spec.skin, spec.face),
    0,
    legH + bodyH + 0.25,
    0,
  )
  group.add(head)

  const legs: THREE.Object3D[] = []
  for (const side of [-1, 1]) {
    const leg = part(material, 0.24, legH + 0.03, 0.24, skin, side * 0.14, legH + 0.01, 0, true)
    legs.push(leg)
    group.add(leg)
  }

  const arms: THREE.Object3D[] = []
  const shoulderY = legH + bodyH - 0.06
  for (const side of [-1, 1]) {
    const arm = part(material, 0.2, 0.68, 0.2, skin, side * (bodyW / 2 + 0.1), shoulderY, 0, true)
    arms.push(arm)
    group.add(arm)
  }

  return { group, material, head, legs, arms, armsRaised: spec.armsRaised }
}

export function buildPigModel(map: THREE.Texture): MobModel {
  return quadruped(map, {
    bodyW: 0.8, bodyH: 0.5, bodyD: 1.0, legW: 0.22, legH: 0.35,
    headSize: 0.5, skin: T.PIG_SKIN, face: T.PIG_FACE,
  })
}

export function buildCowModel(map: THREE.Texture): MobModel {
  return quadruped(map, {
    bodyW: 0.9, bodyH: 0.65, bodyD: 1.2, legW: 0.25, legH: 0.55,
    headSize: 0.55, skin: T.COW_SKIN, face: T.COW_FACE,
  })
}

export function buildSheepModel(map: THREE.Texture): MobModel {
  return quadruped(map, {
    bodyW: 0.85, bodyH: 0.6, bodyD: 1.1, legW: 0.22, legH: 0.45,
    headSize: 0.45, skin: T.SHEEP_WOOL, face: T.SHEEP_FACE,
  })
}

export function buildChickenModel(map: THREE.Texture): MobModel {
  return quadruped(map, {
    bodyW: 0.4, bodyH: 0.45, bodyD: 0.55, legW: 0.12, legH: 0.3,
    headSize: 0.35, skin: T.CHICKEN_SKIN, face: T.CHICKEN_FACE,
  })
}

export function buildZombieModel(map: THREE.Texture): MobModel {
  return humanoid(map, { skin: T.ZOMBIE_SKIN, face: T.ZOMBIE_FACE, armsRaised: true })
}

export function buildSkeletonModel(map: THREE.Texture): MobModel {
  return humanoid(map, { skin: T.SKELETON_SKIN, face: T.SKELETON_FACE, armsRaised: false })
}
