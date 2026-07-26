import type * as THREE from 'three'
import type { TerrainGenerator } from '../world/terrain-generator'
import type { World } from '../world/world'
import type { ParticleEffects } from './particles'
import type { Sky } from './sky'

const SPAWN_INTERVAL_MIN = 0.35
const SPAWN_INTERVAL_MAX = 0.75
const RADIUS = 18

/**
 * Atmosphere spawner: fireflies on night ground, leaves under forest
 * canopies, bubbles underwater. Budgeted to a handful of spawns per second
 * so the shared particle pool always has headroom for combat bursts.
 */
export class AmbientLife {
  private timer = 2

  constructor(
    private readonly world: World,
    private readonly terrain: TerrainGenerator,
    private readonly sky: Sky,
    private readonly effects: ParticleEffects,
  ) {}

  update(dt: number, playerPos: THREE.Vector3, eyeInWater: boolean): void {
    this.timer -= dt
    if (this.timer > 0) return
    this.timer = SPAWN_INTERVAL_MIN + Math.random() * (SPAWN_INTERVAL_MAX - SPAWN_INTERVAL_MIN)

    if (eyeInWater) {
      for (let i = 0; i < 2; i++) {
        this.effects.bubble(
          playerPos.x + (Math.random() - 0.5) * 3,
          playerPos.y + 1 + Math.random(),
          playerPos.z + (Math.random() - 0.5) * 3,
        )
      }
      return
    }

    const wx = playerPos.x + (Math.random() - 0.5) * RADIUS * 2
    const wz = playerPos.z + (Math.random() - 0.5) * RADIUS * 2
    const surface = this.world.surfaceY(wx, wz)
    // Skip columns whose chunk has not generated yet (surfaceY probes stone).
    if (Math.abs(surface - playerPos.y) > 24) return

    if (this.sky.isNight()) {
      this.effects.firefly(wx, surface + 1.2 + Math.random() * 1.6, wz)
      return
    }

    if (this.terrain.biomeAt(wx, wz) === 'forest' && Math.random() < 0.45) {
      const canopy = this.terrain.heightAt(wx, wz) + 5 + Math.random() * 2
      this.effects.fallingLeaf(wx, canopy, wz)
    }
  }
}
