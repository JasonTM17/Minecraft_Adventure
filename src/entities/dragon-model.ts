import * as THREE from 'three'
import { T } from '../world/texture-atlas'
import { tiledBox, uniformTiles, type FaceTiles } from './mob-models'

/** Articulated dragon rig. Root origin at body center, facing -Z. */
export interface DragonRig {
  root: THREE.Group
  material: THREE.MeshLambertMaterial
  /** Empty object at the mouth opening; world-space source of fire. */
  mouth: THREE.Object3D
  animate: (opts: DragonPose) => void
}

export interface DragonPose {
  /** Animation clock in seconds. */
  time: number
  /** Wing beats per second multiplier (0 = glide). */
  flapSpeed: number
  flapAmplitude: number
  /** Neck aim relative to body, radians. */
  neckPitch: number
  neckYaw: number
  /** 0 closed → 1 roaring/breathing. */
  jawOpen: number
  /** Fold legs while flying. */
  legsFolded: boolean
}

const SCALE = 1.6

function box(
  material: THREE.MeshLambertMaterial,
  w: number,
  h: number,
  d: number,
  tiles: FaceTiles,
  x: number,
  y: number,
  z: number,
): THREE.Mesh {
  const mesh = new THREE.Mesh(tiledBox(w, h, d, tiles), material)
  mesh.position.set(x, y, z)
  return mesh
}

export function buildDragonRig(map: THREE.Texture): DragonRig {
  const material = new THREE.MeshLambertMaterial({ map })
  const scale = uniformTiles(T.DRAGON_SCALE)
  const wingTiles = uniformTiles(T.DRAGON_WING)
  const bellyTiles: FaceTiles = { ...scale, ny: T.DRAGON_BELLY }

  const root = new THREE.Group()
  root.scale.setScalar(SCALE)

  root.add(box(material, 1.6, 1.3, 3.2, bellyTiles, 0, 0, 0))

  // Neck: three chained segments angling forward, then the head.
  const neckSegments: THREE.Group[] = []
  let parent: THREE.Object3D = root
  let attachZ = -1.55
  for (let i = 0; i < 3; i++) {
    const pivot = new THREE.Group()
    pivot.position.set(0, 0.28 - i * 0.02, attachZ)
    const size = 0.62 - i * 0.06
    pivot.add(box(material, size, size, 0.7, scale, 0, 0, -0.32))
    parent.add(pivot)
    neckSegments.push(pivot)
    parent = pivot
    attachZ = -0.68
  }

  const headPivot = new THREE.Group()
  headPivot.position.set(0, 0.05, -0.7)
  parent.add(headPivot)
  const headTiles: FaceTiles = { ...scale, nz: T.DRAGON_FACE }
  headPivot.add(box(material, 0.85, 0.65, 1.0, headTiles, 0, 0.1, -0.45))
  for (const side of [-1, 1]) {
    headPivot.add(box(material, 0.14, 0.5, 0.14, scale, side * 0.28, 0.55, -0.1))
  }

  const jawPivot = new THREE.Group()
  jawPivot.position.set(0, -0.18, 0.0)
  jawPivot.add(box(material, 0.7, 0.18, 0.95, scale, 0, -0.09, -0.48))
  headPivot.add(jawPivot)

  const mouth = new THREE.Object3D()
  mouth.position.set(0, -0.05, -1.0)
  headPivot.add(mouth)

  // Wings: shoulder arm + outer membrane, hinged for flapping.
  const shoulders: THREE.Group[] = []
  const membranes: THREE.Group[] = []
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Group()
    shoulder.position.set(side * 0.8, 0.5, -0.4)
    const arm = box(material, 1.7, 0.14, 0.6, wingTiles, side * 0.85, 0, 0)
    shoulder.add(arm)

    const membrane = new THREE.Group()
    membrane.position.set(side * 1.7, 0, 0)
    membrane.add(box(material, 2.3, 0.08, 2.4, wingTiles, side * 1.15, 0, 0.55))
    shoulder.add(membrane)

    root.add(shoulder)
    shoulders.push(shoulder)
    membranes.push(membrane)
  }

  // Tail: five tapering segments that whip with lag.
  const tailSegments: THREE.Group[] = []
  parent = root
  attachZ = 1.55
  for (let i = 0; i < 5; i++) {
    const pivot = new THREE.Group()
    pivot.position.set(0, 0.1 - i * 0.02, attachZ)
    const size = 0.55 - i * 0.09
    pivot.add(box(material, size, size, 0.85, scale, 0, 0, 0.4))
    parent.add(pivot)
    tailSegments.push(pivot)
    parent = pivot
    attachZ = 0.82
  }

  // Legs, folded up in flight.
  const legs: THREE.Group[] = []
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const hip = new THREE.Group()
    hip.position.set(sx * 0.55, -0.6, sz * 0.9)
    hip.add(box(material, 0.32, 0.9, 0.32, scale, 0, -0.45, 0))
    root.add(hip)
    legs.push(hip)
  }

  const animate = (pose: DragonPose): void => {
    const flap = Math.sin(pose.time * pose.flapSpeed * Math.PI * 2)
    const flapLag = Math.sin(pose.time * pose.flapSpeed * Math.PI * 2 - 0.7)
    shoulders.forEach((shoulder, i) => {
      const side = i === 0 ? -1 : 1
      shoulder.rotation.z = side * (-flap * pose.flapAmplitude - 0.12)
    })
    membranes.forEach((membrane, i) => {
      const side = i === 0 ? -1 : 1
      membrane.rotation.z = side * -flapLag * pose.flapAmplitude * 0.8
    })

    neckSegments.forEach((segment) => {
      segment.rotation.x = pose.neckPitch / 3
      segment.rotation.y = pose.neckYaw / 3
    })
    jawPivot.rotation.x = pose.jawOpen * 0.65

    tailSegments.forEach((segment, i) => {
      segment.rotation.y = Math.sin(pose.time * 1.8 - i * 0.7) * 0.16
      segment.rotation.x = Math.sin(pose.time * 1.2 - i * 0.5) * 0.06
    })

    const fold = pose.legsFolded ? 0.9 : 0
    legs.forEach((leg) => {
      leg.rotation.x = fold
    })
  }

  return { root, material, mouth, animate }
}
