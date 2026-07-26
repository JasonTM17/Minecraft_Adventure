import * as THREE from 'three'
import type { World } from '../world/world'
import { Mob, type MobContext } from './mob'
import { buildSkeletonModel, buildZombieModel } from './mob-models'

export type HostileSpecies = 'zombie' | 'skeleton'

const DAWN_BURN_DPS = 4

/** Shared hostile behavior: aggro range, dawn burning, despawn far away. */
abstract class HostileMob extends Mob {
  readonly width = 0.5
  readonly height = 1.9
  protected attackCooldown = 0
  private burnTimer = 0

  /** Returns true while burning in daylight (mob is dying, skip AI). */
  protected handleDawnBurn(dt: number, ctx: MobContext): boolean {
    if (ctx.isNight) return false
    this.burnTimer += dt
    if (Math.random() < 12 * dt) {
      ctx.effects.flame(
        this.position.x,
        this.position.y + this.height * (0.4 + Math.random() * 0.6),
        this.position.z,
      )
    }
    if (this.burnTimer > 0.5) {
      this.hp -= DAWN_BURN_DPS * dt
      if (this.hp <= 0) {
        this.despawning = true
        this.die()
      }
    }
    return true
  }

  protected faceThePlayer(ctx: MobContext): number {
    const dx = ctx.playerPosition.x - this.position.x
    const dz = ctx.playerPosition.z - this.position.z
    return Math.atan2(-dx, -dz)
  }

  protected distanceToPlayer(ctx: MobContext): number {
    return this.position.distanceTo(ctx.playerPosition)
  }
}

/** Relentless melee chaser. */
export class Zombie extends HostileMob {
  constructor(world: World, map: THREE.Texture) {
    super(world, buildZombieModel(map), 14)
  }

  update(dt: number, ctx: MobContext): void {
    this.attackCooldown = Math.max(0, this.attackCooldown - dt)
    const burning = this.handleDawnBurn(dt, ctx)
    const dist = this.distanceToPlayer(ctx)

    if (!burning && dist < 28) {
      const heading = this.faceThePlayer(ctx)
      this.walk(heading, 2.5, dt)
      if (dist < 1.9 && this.attackCooldown <= 0) {
        ctx.damagePlayer(3, 'zombie')
        this.attackCooldown = 1.1
      }
    } else {
      this.velocity.x *= 1 - Math.min(1, 4 * dt)
      this.velocity.z *= 1 - Math.min(1, 4 * dt)
    }

    this.physics(dt)
    this.animate(dt)
  }
}

/** Ranged kiter: keeps distance and fires arrows. */
export class Skeleton extends HostileMob {
  constructor(world: World, map: THREE.Texture) {
    super(world, buildSkeletonModel(map), 12)
    this.attackCooldown = 1.5
  }

  update(dt: number, ctx: MobContext): void {
    this.attackCooldown = Math.max(0, this.attackCooldown - dt)
    const burning = this.handleDawnBurn(dt, ctx)
    const dist = this.distanceToPlayer(ctx)

    if (!burning && dist < 30) {
      const toPlayer = this.faceThePlayer(ctx)
      if (dist < 8) {
        this.walk(toPlayer + Math.PI, 2.2, dt)
        this.yaw = toPlayer
      } else if (dist > 14) {
        this.walk(toPlayer, 2.2, dt)
      } else {
        // Strafe sideways while holding range.
        this.walk(toPlayer + Math.PI / 2, 1.4, dt)
        this.yaw = toPlayer
      }

      if (dist < 26 && this.attackCooldown <= 0 && ctx.shootArrow) {
        const origin = new THREE.Vector3(
          this.position.x,
          this.position.y + 1.4,
          this.position.z,
        )
        const target = ctx.playerPosition.clone()
        target.y += 1.3
        const dir = target.sub(origin).normalize()
        ctx.shootArrow(origin, dir)
        this.attackCooldown = 2.4
      }
    } else {
      this.velocity.x *= 1 - Math.min(1, 4 * dt)
      this.velocity.z *= 1 - Math.min(1, 4 * dt)
    }

    this.physics(dt)
    this.animate(dt)
  }
}
