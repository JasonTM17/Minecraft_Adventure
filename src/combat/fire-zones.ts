import type { ParticleEffects } from '../effects/particles'
import type { PlayerController } from '../player/player-controller'
import type { World } from '../world/world'

interface FireZone {
  x: number
  y: number
  z: number
  ttl: number
}

const MAX_ZONES = 24
const ZONE_TTL = 7
const BURN_DAMAGE = 2

/** Lingering ground fire left by dragon breath and fireball impacts. */
export class FireZones {
  private readonly zones: FireZone[] = []

  constructor(
    private readonly world: World,
    private readonly effects: ParticleEffects,
  ) {}

  /** Ignite the ground surface nearest to (x, z). */
  ignite(x: number, z: number): void {
    const y = this.world.surfaceY(Math.floor(x), Math.floor(z)) + 1
    if (this.zones.length >= MAX_ZONES) this.zones.shift()
    this.zones.push({ x, y, z, ttl: ZONE_TTL })
  }

  igniteBurst(x: number, z: number, count: number, spread: number): void {
    for (let i = 0; i < count; i++) {
      this.ignite(x + (Math.random() - 0.5) * spread, z + (Math.random() - 0.5) * spread)
    }
  }

  update(
    dt: number,
    player: PlayerController,
    damagePlayer: (amount: number, source: string) => void,
  ): void {
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const zone = this.zones[i] as FireZone
      zone.ttl -= dt
      if (zone.ttl <= 0) {
        this.zones.splice(i, 1)
        continue
      }

      if (Math.random() < 14 * dt) {
        this.effects.flame(zone.x, zone.y + 0.1, zone.z)
      }
      if (Math.random() < 3 * dt) {
        this.effects.smoke(zone.x, zone.y + 0.6, zone.z)
      }

      const dx = player.position.x - zone.x
      const dz = player.position.z - zone.z
      const dy = player.position.y - zone.y
      if (dx * dx + dz * dz < 1.4 && dy > -1.5 && dy < 2) {
        damagePlayer(BURN_DAMAGE, 'fire')
      }
    }
  }
}
