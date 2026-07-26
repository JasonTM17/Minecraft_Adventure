import * as THREE from 'three'
import type { InputManager } from '../core/input-manager'
import { Block, blockDef } from '../world/block-registry'
import { CRACK_TILES, tileUV } from '../world/texture-atlas'
import type { World } from '../world/world'
import type { Inventory } from './inventory'
import type { PlayerController } from './player-controller'

const REACH = 5

export interface VoxelHit {
  x: number
  y: number
  z: number
  id: number
  /** The empty cell the ray passed through just before hitting (place target). */
  prevX: number
  prevY: number
  prevZ: number
}

/** Amanatides–Woo DDA traversal through the voxel grid. */
export function raycastVoxel(
  world: World,
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  maxDist: number,
): VoxelHit | null {
  let x = Math.floor(origin.x)
  let y = Math.floor(origin.y)
  let z = Math.floor(origin.z)
  const stepX = Math.sign(dir.x)
  const stepY = Math.sign(dir.y)
  const stepZ = Math.sign(dir.z)
  const tDeltaX = stepX !== 0 ? Math.abs(1 / dir.x) : Infinity
  const tDeltaY = stepY !== 0 ? Math.abs(1 / dir.y) : Infinity
  const tDeltaZ = stepZ !== 0 ? Math.abs(1 / dir.z) : Infinity
  let tMaxX = stepX > 0 ? (x + 1 - origin.x) * tDeltaX : stepX < 0 ? (origin.x - x) * tDeltaX : Infinity
  let tMaxY = stepY > 0 ? (y + 1 - origin.y) * tDeltaY : stepY < 0 ? (origin.y - y) * tDeltaY : Infinity
  let tMaxZ = stepZ > 0 ? (z + 1 - origin.z) * tDeltaZ : stepZ < 0 ? (origin.z - z) * tDeltaZ : Infinity

  let prevX = x
  let prevY = y
  let prevZ = z
  let t = 0
  while (t <= maxDist) {
    const id = world.getBlock(x, y, z)
    const def = blockDef(id)
    if (id !== Block.AIR && !def.fluid) {
      return { x, y, z, id, prevX, prevY, prevZ }
    }
    prevX = x
    prevY = y
    prevZ = z
    if (tMaxX <= tMaxY && tMaxX <= tMaxZ) {
      x += stepX
      t = tMaxX
      tMaxX += tDeltaX
    } else if (tMaxY <= tMaxZ) {
      y += stepY
      t = tMaxY
      tMaxY += tDeltaY
    } else {
      z += stepZ
      t = tMaxZ
      tMaxZ += tDeltaZ
    }
  }
  return null
}

/** Aim highlight, hold-to-break with progress, and right-click placement. */
export class BlockInteraction {
  private readonly highlight: THREE.LineSegments
  private readonly highlightMaterial: THREE.LineBasicMaterial
  private readonly crackMesh: THREE.Mesh
  private readonly crackBaseUv: Float32Array
  private crackStage = -1
  private breakKey = ''
  private breakProgress = 0
  currentHit: VoxelHit | null = null
  /** Set by combat for a moment after a melee hit lands. */
  suppressed = false
  onBlockBroken: ((x: number, y: number, z: number, id: number) => void) | null = null
  onBlockPlaced: ((x: number, y: number, z: number, id: number) => void) | null = null

  constructor(
    private readonly world: World,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly input: InputManager,
    private readonly player: PlayerController,
    private readonly inventory: Inventory,
    scene: THREE.Scene,
    atlasTexture: THREE.Texture,
  ) {
    this.highlightMaterial = new THREE.LineBasicMaterial({ color: 0x111111 })
    this.highlight = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002)),
      this.highlightMaterial,
    )
    this.highlight.visible = false
    scene.add(this.highlight)

    // Slightly oversized shell showing the crack stage while mining.
    const crackGeometry = new THREE.BoxGeometry(1.004, 1.004, 1.004)
    this.crackBaseUv = new Float32Array(
      (crackGeometry.getAttribute('uv') as THREE.BufferAttribute).array,
    )
    this.crackMesh = new THREE.Mesh(
      crackGeometry,
      new THREE.MeshBasicMaterial({
        map: atlasTexture,
        alphaTest: 0.4,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    )
    this.crackMesh.visible = false
    scene.add(this.crackMesh)
  }

  /** Remap the box UVs onto one crack tile of the shared atlas. */
  private setCrackStage(stage: number): void {
    if (stage === this.crackStage) return
    this.crackStage = stage
    const tile = CRACK_TILES[Math.max(0, Math.min(CRACK_TILES.length - 1, stage))] as number
    const [u0, v0, u1, v1] = tileUV(tile)
    const uv = this.crackMesh.geometry.getAttribute('uv') as THREE.BufferAttribute
    for (let i = 0; i < uv.count; i++) {
      const u = this.crackBaseUv[i * 2] as number
      const v = this.crackBaseUv[i * 2 + 1] as number
      uv.setXY(i, u0 + u * (u1 - u0), v0 + v * (v1 - v0))
    }
    uv.needsUpdate = true
  }

  /** True while actively mining a block (drives the held-item swing loop). */
  get isBreaking(): boolean {
    return this.breakKey !== ''
  }

  /** Clear mining feedback when gameplay is interrupted (death, victory). */
  cancel(): void {
    this.resetBreaking()
    this.highlight.visible = false
  }

  update(dt: number): void {
    const dir = this.camera.getWorldDirection(new THREE.Vector3())
    const hit = raycastVoxel(this.world, this.player.eyePosition, dir, REACH)
    this.currentHit = hit

    if (!hit) {
      this.highlight.visible = false
      this.resetBreaking()
      return
    }

    this.highlight.visible = true
    this.highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5)

    if (this.input.isButtonDown(0) && !this.suppressed) this.advanceBreaking(hit, dt)
    else this.resetBreaking()

    if (this.input.wasClicked(2)) this.tryPlace(hit)
  }

  private resetBreaking(): void {
    this.breakKey = ''
    this.breakProgress = 0
    this.highlightMaterial.color.setHex(0x111111)
    this.crackMesh.visible = false
    this.crackStage = -1
  }

  private advanceBreaking(hit: VoxelHit, dt: number): void {
    const def = blockDef(hit.id)
    if (!Number.isFinite(def.breakTime)) {
      this.resetBreaking()
      return
    }
    const key = `${hit.x},${hit.y},${hit.z}`
    if (key !== this.breakKey) {
      this.breakKey = key
      this.breakProgress = 0
    }
    this.breakProgress += dt / def.breakTime
    // Highlight heats from dark to orange as the break progresses.
    this.highlightMaterial.color.setHSL(0.08, 1, Math.min(0.55, this.breakProgress * 0.55))

    this.crackMesh.visible = true
    this.crackMesh.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5)
    this.setCrackStage(Math.min(3, Math.floor(this.breakProgress * 4)))

    if (this.breakProgress >= 1) {
      this.world.setBlock(hit.x, hit.y, hit.z, Block.AIR)
      this.inventory.addBlock(def.drops)
      this.onBlockBroken?.(hit.x, hit.y, hit.z, hit.id)
      this.resetBreaking()
    }
  }

  private tryPlace(hit: VoxelHit): void {
    const tx = hit.prevX
    const ty = hit.prevY
    const tz = hit.prevZ
    const existing = blockDef(this.world.getBlock(tx, ty, tz))
    const replaceable = !existing.solid
    if (!replaceable) return
    if (this.overlapsPlayer(tx, ty, tz)) return

    const blockId = this.inventory.consumeSelectedBlock()
    if (blockId === null) return
    this.world.setBlock(tx, ty, tz, blockId)
    this.onBlockPlaced?.(tx, ty, tz, blockId)
  }

  private overlapsPlayer(bx: number, by: number, bz: number): boolean {
    const p = this.player.position
    const hw = this.player.width / 2
    return (
      bx < p.x + hw &&
      bx + 1 > p.x - hw &&
      by < p.y + this.player.height &&
      by + 1 > p.y &&
      bz < p.z + hw &&
      bz + 1 > p.z - hw
    )
  }
}
