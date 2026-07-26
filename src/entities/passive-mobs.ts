import type * as THREE from 'three'
import type { World } from '../world/world'
import { Mob, type MobContext } from './mob'
import {
  buildChickenModel,
  buildCowModel,
  buildPigModel,
  buildSheepModel,
  type MobModel,
} from './mob-models'

export type PassiveSpecies = 'pig' | 'cow' | 'sheep' | 'chicken'

interface SpeciesStats {
  hp: number
  speed: number
  width: number
  height: number
  meatDrop: number
  build: (map: THREE.Texture) => MobModel
}

export const PASSIVE_STATS: Readonly<Record<PassiveSpecies, SpeciesStats>> = {
  pig: { hp: 8, speed: 1.6, width: 0.8, height: 0.9, meatDrop: 2, build: buildPigModel },
  cow: { hp: 10, speed: 1.4, width: 0.9, height: 1.25, meatDrop: 2, build: buildCowModel },
  sheep: { hp: 8, speed: 1.4, width: 0.85, height: 1.1, meatDrop: 1, build: buildSheepModel },
  chicken: { hp: 4, speed: 1.2, width: 0.4, height: 0.8, meatDrop: 1, build: buildChickenModel },
}

type PassiveState = 'idle' | 'wander' | 'flee'

/** Grazing animal: idles, wanders, flees when hurt, drops meat on death. */
export class PassiveMob extends Mob {
  readonly width: number
  readonly height: number
  readonly meatDrop: number
  private readonly speed: number
  private state: PassiveState = 'idle'
  private stateTime = 1 + Math.random() * 3
  private heading = Math.random() * Math.PI * 2

  constructor(
    world: World,
    map: THREE.Texture,
    readonly species: PassiveSpecies,
  ) {
    const stats = PASSIVE_STATS[species]
    super(world, stats.build(map), stats.hp)
    this.width = stats.width
    this.height = stats.height
    this.speed = stats.speed
    this.meatDrop = stats.meatDrop
  }

  override damage(amount: number, knockDir?: THREE.Vector3): void {
    super.damage(amount, knockDir)
    if (!this.dead) {
      this.state = 'flee'
      this.stateTime = 4
      if (knockDir) this.heading = Math.atan2(-knockDir.x, -knockDir.z)
    }
  }

  update(dt: number, ctx: MobContext): void {
    this.stateTime -= dt
    switch (this.state) {
      case 'idle':
        this.velocity.x *= 1 - Math.min(1, 6 * dt)
        this.velocity.z *= 1 - Math.min(1, 6 * dt)
        if (this.stateTime <= 0) {
          this.state = 'wander'
          this.stateTime = 2 + Math.random() * 4
          this.heading = Math.random() * Math.PI * 2
        }
        break
      case 'wander':
        this.walk(this.heading, this.speed, dt)
        if (this.stateTime <= 0) {
          this.state = 'idle'
          this.stateTime = 2 + Math.random() * 3
        }
        break
      case 'flee': {
        // Run from the player, refreshed each frame while fleeing.
        const dx = this.position.x - ctx.playerPosition.x
        const dz = this.position.z - ctx.playerPosition.z
        this.heading = Math.atan2(-dx, -dz) + Math.PI
        this.walk(this.heading, this.speed * 2.2, dt)
        if (this.stateTime <= 0) {
          this.state = 'idle'
          this.stateTime = 2
        }
        break
      }
    }

    this.physics(dt)
    this.animate(dt)
  }
}
