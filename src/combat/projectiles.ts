import * as THREE from 'three'
import type { ParticleEffects } from '../effects/particles'
import type { Mob } from '../entities/mob'
import type { PlayerController } from '../player/player-controller'
import { isSolid } from '../world/block-registry'
import type { World } from '../world/world'

export type ProjectileKind = 'arrow' | 'fireball'
export type ProjectileOwner = 'player' | 'mob' | 'dragon'

/** Anything besides mobs that projectiles and melee can hurt (crystals, dragon). */
export interface Hittable {
  position: THREE.Vector3
  hitRadius: number
  alive: boolean
  takeHit(amount: number, dir: THREE.Vector3): void
}

interface Projectile {
  kind: ProjectileKind
  owner: ProjectileOwner
  pos: THREE.Vector3
  vel: THREE.Vector3
  mesh: THREE.Object3D
  ttl: number
}

const ARROW_GRAVITY = 16
const ARROW_DAMAGE_TO_MOB = 6
const ARROW_DAMAGE_TO_PLAYER = 3
const FIREBALL_DAMAGE = 5

export interface ProjectileTargets {
  player: PlayerController
  mobs: readonly Mob[]
  hittables: readonly Hittable[]
  damagePlayer: (amount: number, source: string) => void
}

/** Active arrows and fireballs with voxel + entity collision. */
export class Projectiles {
  private readonly list: Projectile[] = []
  /** Dragon fireballs scorch the ground where they land. */
  onFireballExplode: ((x: number, y: number, z: number) => void) | null = null
  /** Any arrow striking terrain, a mob or the player (impact thunk sound). */
  onArrowImpact: ((x: number, y: number, z: number) => void) | null = null

  constructor(
    private readonly scene: THREE.Scene,
    private readonly world: World,
    private readonly effects: ParticleEffects,
  ) {}

  spawnArrow(origin: THREE.Vector3, dir: THREE.Vector3, owner: ProjectileOwner, speed = 30): void {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.05, 0.55),
      new THREE.MeshLambertMaterial({ color: owner === 'player' ? 0xd8d0c0 : 0xb0a898 }),
    )
    mesh.position.copy(origin)
    this.scene.add(mesh)
    this.list.push({
      kind: 'arrow',
      owner,
      pos: origin.clone(),
      vel: dir.clone().multiplyScalar(speed),
      mesh,
      ttl: 6,
    })
  }

  spawnFireball(origin: THREE.Vector3, dir: THREE.Vector3, speed = 16): void {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xff8a2a }),
    )
    mesh.position.copy(origin)
    this.scene.add(mesh)
    this.list.push({
      kind: 'fireball',
      owner: 'dragon',
      pos: origin.clone(),
      vel: dir.clone().multiplyScalar(speed),
      mesh,
      ttl: 8,
    })
  }

  update(dt: number, targets: ProjectileTargets): void {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i] as Projectile
      p.ttl -= dt
      if (p.ttl <= 0) {
        this.remove(i)
        continue
      }

      if (p.kind === 'arrow') p.vel.y -= ARROW_GRAVITY * dt
      else if (Math.random() < 30 * dt) {
        this.effects.flame(p.pos.x, p.pos.y, p.pos.z, 0, 0.5, 0)
      }

      const stepDist = p.vel.length() * dt
      const steps = Math.max(1, Math.ceil(stepDist / 0.4))
      let removed = false
      for (let s = 0; s < steps && !removed; s++) {
        p.pos.addScaledVector(p.vel, dt / steps)
        removed = this.collide(i, p, targets)
      }
      if (removed) continue

      p.mesh.position.copy(p.pos)
      const look = p.pos.clone().add(p.vel)
      p.mesh.lookAt(look)
    }
  }

  private collide(index: number, p: Projectile, targets: ProjectileTargets): boolean {
    // Voxel hit.
    if (isSolid(this.world.getBlock(Math.floor(p.pos.x), Math.floor(p.pos.y), Math.floor(p.pos.z)))) {
      if (p.kind === 'fireball') {
        this.explode(p, targets)
      } else {
        this.effects.smoke(p.pos.x, p.pos.y, p.pos.z)
        this.onArrowImpact?.(p.pos.x, p.pos.y, p.pos.z)
      }
      this.remove(index)
      return true
    }

    // Player hit (hostile shots only).
    if (p.owner !== 'player') {
      const pl = targets.player
      const hw = pl.width / 2
      if (
        p.pos.x > pl.position.x - hw && p.pos.x < pl.position.x + hw &&
        p.pos.y > pl.position.y && p.pos.y < pl.position.y + pl.height &&
        p.pos.z > pl.position.z - hw && p.pos.z < pl.position.z + hw
      ) {
        if (p.kind === 'fireball') {
          this.explode(p, targets)
        } else {
          targets.damagePlayer(ARROW_DAMAGE_TO_PLAYER, 'arrow')
          this.onArrowImpact?.(p.pos.x, p.pos.y, p.pos.z)
        }
        this.remove(index)
        return true
      }
    }

    // Mob / hittable hits (player shots only).
    if (p.owner === 'player') {
      for (const mob of targets.mobs) {
        if (mob.dead) continue
        const hw = mob.width / 2 + 0.1
        if (
          p.pos.x > mob.position.x - hw && p.pos.x < mob.position.x + hw &&
          p.pos.y > mob.position.y && p.pos.y < mob.position.y + mob.height + 0.1 &&
          p.pos.z > mob.position.z - hw && p.pos.z < mob.position.z + hw
        ) {
          const dir = p.vel.clone().setY(0).normalize()
          mob.damage(ARROW_DAMAGE_TO_MOB, dir)
          this.onArrowImpact?.(p.pos.x, p.pos.y, p.pos.z)
          this.remove(index)
          return true
        }
      }
      for (const h of targets.hittables) {
        if (!h.alive) continue
        if (p.pos.distanceTo(h.position) < h.hitRadius) {
          h.takeHit(ARROW_DAMAGE_TO_MOB, p.vel.clone().normalize())
          this.remove(index)
          return true
        }
      }
    }
    return false
  }

  private explode(p: Projectile, targets: ProjectileTargets): void {
    this.effects.explosion(p.pos.x, p.pos.y, p.pos.z, 1)
    if (targets.player.eyePosition.distanceTo(p.pos) < 4) {
      targets.damagePlayer(FIREBALL_DAMAGE, 'fireball')
    }
    this.onFireballExplode?.(p.pos.x, p.pos.y, p.pos.z)
  }

  private remove(index: number): void {
    const p = this.list[index] as Projectile
    this.scene.remove(p.mesh)
    const mesh = p.mesh as THREE.Mesh
    mesh.geometry.dispose()
    ;(mesh.material as THREE.Material).dispose()
    this.list.splice(index, 1)
  }
}
