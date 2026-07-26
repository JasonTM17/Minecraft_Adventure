import type * as THREE from 'three'
import { isSolid } from '../world/block-registry'
import type { VoxelSource } from '../world/chunk-mesher'
import { Block, blockDef } from '../world/block-registry'

const EPS = 0.001
const MAX_AXIS_STEP = 0.4

/** Shared movement body: feet-center position + velocity + size. */
export interface PhysicsBody {
  position: THREE.Vector3
  velocity: THREE.Vector3
  /** Full XZ width of the AABB. */
  width: number
  height: number
  onGround: boolean
}

function boxCollides(
  world: VoxelSource,
  px: number,
  py: number,
  pz: number,
  halfW: number,
  height: number,
): boolean {
  const minX = Math.floor(px - halfW)
  const maxX = Math.floor(px + halfW)
  const minY = Math.floor(py)
  const maxY = Math.floor(py + height - EPS)
  const minZ = Math.floor(pz - halfW)
  const maxZ = Math.floor(pz + halfW)
  for (let bx = minX; bx <= maxX; bx++) {
    for (let by = minY; by <= maxY; by++) {
      for (let bz = minZ; bz <= maxZ; bz++) {
        if (isSolid(world.getBlock(bx, by, bz))) return true
      }
    }
  }
  return false
}

function sweepAxis(
  world: VoxelSource,
  body: PhysicsBody,
  axis: 'x' | 'y' | 'z',
  delta: number,
): void {
  if (delta === 0) return
  const halfW = body.width / 2
  const p = body.position
  p[axis] += delta
  if (!boxCollides(world, p.x, p.y, p.z, halfW, body.height)) return

  if (axis === 'y') {
    if (delta < 0) {
      p.y = Math.floor(p.y) + 1 + EPS
      body.onGround = true
    } else {
      p.y = Math.floor(p.y + body.height) - body.height - EPS
    }
  } else {
    const bound = halfW
    if (delta > 0) p[axis] = Math.floor(p[axis] + bound) - bound - EPS
    else p[axis] = Math.floor(p[axis] - bound) + 1 + bound + EPS
  }
  body.velocity[axis] = 0
}

/**
 * Integrate one physics step with axis-separated collision resolution.
 * Splits large motions into sub-steps so fast bodies cannot tunnel.
 */
export function moveBody(world: VoxelSource, body: PhysicsBody, dt: number): void {
  body.onGround = false
  const dx = body.velocity.x * dt
  const dy = body.velocity.y * dt
  const dz = body.velocity.z * dt
  const steps = Math.max(
    1,
    Math.ceil(Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) / MAX_AXIS_STEP),
  )
  for (let i = 0; i < steps; i++) {
    sweepAxis(world, body, 'y', dy / steps)
    sweepAxis(world, body, 'x', dx / steps)
    sweepAxis(world, body, 'z', dz / steps)
  }
}

/** True when the body's lower half is inside a fluid block. */
export function isBodyInWater(world: VoxelSource, body: PhysicsBody): boolean {
  const p = body.position
  const id = world.getBlock(Math.floor(p.x), Math.floor(p.y + 0.4), Math.floor(p.z))
  return blockDef(id).fluid === true
}

/** True when the block at the body's eye line is fluid (for underwater fog). */
export function isEyeInWater(world: VoxelSource, body: PhysicsBody, eyeHeight: number): boolean {
  const p = body.position
  const id = world.getBlock(Math.floor(p.x), Math.floor(p.y + eyeHeight), Math.floor(p.z))
  return id === Block.WATER
}
