import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { Block } from '../../src/world/block-registry'
import {
  isBodyInWater,
  isEyeInWater,
  moveBody,
  type PhysicsBody,
} from '../../src/player/voxel-physics'

/**
 * Minimal stand-in for the World: flat stone floor below y=10, air above,
 * with an optional override for extra features (walls, water pockets).
 * Structurally matches the VoxelSource interface (getBlock) without
 * importing the real chunk-mesher module.
 */
class FakeWorld {
  constructor(private readonly extra?: (x: number, y: number, z: number) => number | null) {}

  getBlock(x: number, y: number, z: number): number {
    const override = this.extra?.(x, y, z)
    if (override !== null && override !== undefined) return override
    return y < 10 ? Block.STONE : Block.AIR
  }
}

function makeBody(overrides: Partial<PhysicsBody> = {}): PhysicsBody {
  return {
    position: new Vector3(0, 15, 0),
    velocity: new Vector3(0, 0, 0),
    width: 0.6,
    height: 1.8,
    onGround: false,
    ...overrides,
  }
}

describe('moveBody falling', () => {
  it('falls onto a flat floor and stops with onGround true', () => {
    const world = new FakeWorld()
    const body = makeBody({ position: new Vector3(0, 15, 0), velocity: new Vector3(0, -20, 0) })

    moveBody(world, body, 1)

    expect(body.onGround).toBe(true)
    expect(body.velocity.y).toBe(0)
    expect(body.position.y).toBeCloseTo(10, 2)
  })

  it('rests on the floor without sinking through on the next frame', () => {
    const world = new FakeWorld()
    const body = makeBody({ position: new Vector3(0, 15, 0), velocity: new Vector3(0, -20, 0) })
    moveBody(world, body, 1)
    const restY = body.position.y

    body.velocity.y = -20
    moveBody(world, body, 1 / 60)

    expect(body.onGround).toBe(true)
    expect(body.position.y).toBeCloseTo(restY, 3)
  })
})

describe('moveBody horizontal sweep', () => {
  it('stops at a solid wall column instead of passing through it', () => {
    const world = new FakeWorld((x, y, z) =>
      x === 5 && y >= 10 && y <= 11 && z >= -1 && z <= 1 ? Block.STONE : null,
    )
    const body = makeBody({ position: new Vector3(0, 10, 0), velocity: new Vector3(5, 0, 0) })

    moveBody(world, body, 1)

    expect(body.position.x).toBeLessThan(5)
    expect(body.position.x).toBeGreaterThan(4)
    expect(body.velocity.x).toBe(0)
  })

  it('moves freely on the x axis when no wall is in the path', () => {
    const world = new FakeWorld()
    const body = makeBody({ position: new Vector3(0, 10, 0), velocity: new Vector3(5, 0, 0) })

    moveBody(world, body, 1)

    expect(body.position.x).toBeCloseTo(5, 3)
    expect(body.velocity.x).toBe(5)
  })
})

describe('isBodyInWater', () => {
  it('is true when the body sits inside a water block region', () => {
    const world = new FakeWorld((x, y, z) => (x === 0 && z === 0 && y === 4 ? Block.WATER : null))
    const body = makeBody({ position: new Vector3(0, 3.7, 0) }) // floor(3.7 + 0.4) = 4

    expect(isBodyInWater(world, body)).toBe(true)
  })

  it('is false on dry land', () => {
    const world = new FakeWorld()
    const body = makeBody({ position: new Vector3(0, 10, 0) })

    expect(isBodyInWater(world, body)).toBe(false)
  })
})

describe('isEyeInWater', () => {
  it('is true when the eye-height sample lands on a water block', () => {
    const world = new FakeWorld((x, y, z) => (x === 0 && z === 0 && y === 11 ? Block.WATER : null))
    const body = makeBody({ position: new Vector3(0, 10, 0) })

    expect(isEyeInWater(world, body, 1.62)).toBe(true) // floor(10 + 1.62) = 11
  })

  it('is false when the eye-height sample is air', () => {
    const world = new FakeWorld()
    const body = makeBody({ position: new Vector3(0, 10, 0) })

    expect(isEyeInWater(world, body, 1.62)).toBe(false)
  })
})
