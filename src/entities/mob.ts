import * as THREE from 'three'
import type { ParticleEffects } from '../effects/particles'
import { moveBody, type PhysicsBody } from '../player/voxel-physics'
import { blockDef } from '../world/block-registry'
import type { World } from '../world/world'
import type { MobModel } from './mob-models'

/** Per-frame context handed to every mob update. */
export interface MobContext {
  playerPosition: THREE.Vector3
  isNight: boolean
  effects: ParticleEffects
  damagePlayer: (amount: number, source: string) => void
  /** Wired by the combat system; skeletons hold fire until it exists. */
  shootArrow: ((origin: THREE.Vector3, dir: THREE.Vector3) => void) | null
}

/** Base creature: voxel physics, health, knockback, hurt flash, limb swing. */
export abstract class Mob implements PhysicsBody {
  readonly position = new THREE.Vector3()
  readonly velocity = new THREE.Vector3()
  abstract readonly width: number
  abstract readonly height: number
  onGround = false
  yaw = 0
  hp: number
  dead = false
  /** Marked by AI (dawn burn, out of range); spawner removes it. */
  despawning = false
  /** Horizontal distance walked, drives leg swing phase. */
  walkDistance = 0
  protected hurtFlash = 0
  onDeath: ((mob: Mob) => void) | null = null

  constructor(
    protected readonly world: World,
    readonly model: MobModel,
    hp: number,
  ) {
    this.hp = hp
  }

  get group(): THREE.Group {
    return this.model.group
  }

  abstract update(dt: number, ctx: MobContext): void

  /** Integrate gravity + collision and track walked distance. */
  protected physics(dt: number): void {
    this.velocity.y -= 26 * dt
    const beforeX = this.position.x
    const beforeZ = this.position.z
    moveBody(this.world, this, dt)
    const dx = this.position.x - beforeX
    const dz = this.position.z - beforeZ
    this.walkDistance += Math.sqrt(dx * dx + dz * dz)
  }

  /** Walk toward a heading (radians), hopping single-block steps. */
  protected walk(heading: number, speed: number, dt: number): void {
    const vx = -Math.sin(heading) * speed
    const vz = -Math.cos(heading) * speed
    const blend = 1 - Math.exp(-8 * dt)
    this.velocity.x += (vx - this.velocity.x) * blend
    this.velocity.z += (vz - this.velocity.z) * blend
    this.yaw = heading

    // Blocked horizontally while grounded → hop.
    if (this.onGround) {
      const actual = Math.hypot(this.velocity.x, this.velocity.z)
      if (actual > 0.1) {
        const aheadX = this.position.x - Math.sin(heading) * (this.width / 2 + 0.35)
        const aheadZ = this.position.z - Math.cos(heading) * (this.width / 2 + 0.35)
        const feetY = Math.floor(this.position.y + 0.1)
        const blocked = this.world.getBlock(Math.floor(aheadX), feetY, Math.floor(aheadZ))
        if (blocked !== 0 && this.solidAhead(aheadX, feetY, aheadZ)) {
          this.velocity.y = 8.5
        }
      }
    }
  }

  private solidAhead(x: number, feetY: number, z: number): boolean {
    return blockDef(this.world.getBlock(Math.floor(x), feetY, Math.floor(z))).solid
  }

  damage(amount: number, knockDir?: THREE.Vector3): void {
    if (this.dead) return
    this.hp -= amount
    this.hurtFlash = 0.35
    if (knockDir) {
      this.velocity.x += knockDir.x * 7
      this.velocity.z += knockDir.z * 7
      this.velocity.y += 4
    }
    if (this.hp <= 0) this.die()
  }

  die(): void {
    if (this.dead) return
    this.dead = true
    this.onDeath?.(this)
  }

  /** Sync mesh transform, hurt tint and leg swing. Call at end of update. */
  protected animate(dt: number): void {
    this.group.position.copy(this.position)
    this.group.rotation.y = this.yaw

    this.hurtFlash = Math.max(0, this.hurtFlash - dt)
    const tint = this.hurtFlash > 0 ? 0.45 : 0
    this.model.material.color.setRGB(1, 1 - tint, 1 - tint)

    const swing = Math.sin(this.walkDistance * 2.6) * 0.65
    const speedFactor = Math.min(1, Math.hypot(this.velocity.x, this.velocity.z) / 1.5)
    this.model.legs.forEach((leg: THREE.Object3D, i: number) => {
      leg.rotation.x = swing * (i % 2 === 0 ? 1 : -1) * speedFactor
    })
    this.model.arms?.forEach((arm: THREE.Object3D, i: number) => {
      arm.rotation.x = this.model.armsRaised
        ? -1.35 + Math.sin(this.walkDistance * 2.6) * 0.12
        : swing * (i % 2 === 0 ? -1 : 1) * speedFactor * 0.8
    })
  }
}
