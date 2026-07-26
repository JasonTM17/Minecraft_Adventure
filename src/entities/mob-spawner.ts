import * as THREE from 'three'
import type { World } from '../world/world'
import { Skeleton, Zombie } from './hostile-mobs'
import type { Mob, MobContext } from './mob'
import { PassiveMob, type PassiveSpecies } from './passive-mobs'
import type { Pickups } from './pickups'

const MAX_PASSIVE = 22
const MAX_HOSTILE = 12
const SPAWN_INTERVAL = 1.2
const DESPAWN_DIST = 80

const SPECIES_POOL: readonly PassiveSpecies[] = ['pig', 'pig', 'cow', 'cow', 'sheep', 'chicken']

/** Keeps the world populated: day animals, night monsters, drops on death. */
export class MobSpawner {
  readonly mobs: Mob[] = []
  /** Fired when a mob actually dies (not despawn/burn cleanup). */
  onMobKilled: ((mob: Mob) => void) | null = null
  private spawnTimer = 0

  constructor(
    private readonly scene: THREE.Scene,
    private readonly world: World,
    private readonly map: THREE.Texture,
    private readonly pickups: Pickups,
  ) {}

  update(dt: number, ctx: MobContext): void {
    this.spawnTimer -= dt
    if (this.spawnTimer <= 0) {
      this.spawnTimer = SPAWN_INTERVAL
      this.attemptSpawns(ctx)
    }

    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const mob = this.mobs[i] as Mob
      mob.update(dt, ctx)

      if (mob.dead) {
        this.handleDeath(mob, ctx)
        this.remove(i)
        continue
      }
      if (mob.position.distanceTo(ctx.playerPosition) > DESPAWN_DIST) {
        this.remove(i)
      }
    }
  }

  private handleDeath(mob: Mob, ctx: MobContext): void {
    for (let s = 0; s < 10; s++) {
      ctx.effects.smoke(mob.position.x, mob.position.y + 0.5, mob.position.z)
    }
    if (!mob.despawning) this.onMobKilled?.(mob)
    if (mob instanceof PassiveMob && !mob.despawning) {
      for (let d = 0; d < mob.meatDrop; d++) {
        this.pickups.spawn(
          'meat',
          mob.position.x + (Math.random() - 0.5),
          mob.position.y,
          mob.position.z + (Math.random() - 0.5),
        )
      }
    }
  }

  private remove(index: number): void {
    const mob = this.mobs[index] as Mob
    this.scene.remove(mob.group)
    // Each mob owns its geometries and one material; free the GPU buffers.
    mob.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) obj.geometry.dispose()
    })
    mob.model.material.dispose()
    this.mobs.splice(index, 1)
  }

  private counts(): { passive: number; hostile: number } {
    let passive = 0
    let hostile = 0
    for (const mob of this.mobs) {
      if (mob instanceof PassiveMob) passive++
      else hostile++
    }
    return { passive, hostile }
  }

  private attemptSpawns(ctx: MobContext): void {
    const { passive, hostile } = this.counts()

    if (!ctx.isNight && passive < MAX_PASSIVE) {
      const spot = this.pickSpot(ctx, 22, 40)
      if (spot) {
        const species = SPECIES_POOL[Math.floor(Math.random() * SPECIES_POOL.length)] as PassiveSpecies
        const groupSize = 1 + Math.floor(Math.random() * 3)
        for (let i = 0; i < groupSize && passive + i < MAX_PASSIVE; i++) {
          const ox = spot.x + (Math.random() - 0.5) * 4
          const oz = spot.z + (Math.random() - 0.5) * 4
          if (!this.world.isDryLand(Math.floor(ox), Math.floor(oz))) continue
          this.spawnPassive(species, ox, oz)
        }
      }
    }

    if (ctx.isNight && hostile < MAX_HOSTILE) {
      const spot = this.pickSpot(ctx, 24, 44)
      if (spot) {
        if (Math.random() < 0.6) this.spawnHostile(new Zombie(this.world, this.map), spot.x, spot.z)
        else this.spawnHostile(new Skeleton(this.world, this.map), spot.x, spot.z)
      }
    }
  }

  private pickSpot(
    ctx: MobContext,
    minDist: number,
    maxDist: number,
  ): { x: number; z: number } | null {
    for (let attempt = 0; attempt < 3; attempt++) {
      const angle = Math.random() * Math.PI * 2
      const dist = minDist + Math.random() * (maxDist - minDist)
      const x = ctx.playerPosition.x + Math.cos(angle) * dist
      const z = ctx.playerPosition.z + Math.sin(angle) * dist
      if (this.world.isDryLand(Math.floor(x), Math.floor(z))) return { x, z }
    }
    return null
  }

  private spawnPassive(species: PassiveSpecies, x: number, z: number): void {
    const mob = new PassiveMob(this.world, this.map, species)
    this.place(mob, x, z)
  }

  private spawnHostile(mob: Mob, x: number, z: number): void {
    this.place(mob, x, z)
  }

  private place(mob: Mob, x: number, z: number): void {
    const y = this.world.surfaceY(Math.floor(x), Math.floor(z)) + 1
    mob.position.set(x, y + 0.1, z)
    this.scene.add(mob.group)
    this.mobs.push(mob)
  }
}
