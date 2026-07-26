import * as THREE from 'three'
import type { InputManager } from '../core/input-manager'
import type { ParticleEffects } from '../effects/particles'
import type { Mob } from '../entities/mob'
import type { Inventory } from '../player/inventory'
import type { PlayerController } from '../player/player-controller'
import type { Hittable, Projectiles } from './projectiles'

const MELEE_RANGE = 4
const MELEE_DAMAGE = 7
const MELEE_COOLDOWN = 0.45
const BOW_MIN_CHARGE = 0.15
const EAT_HEAL = 4

export interface CombatEvents {
  onMeleeHit?: () => void
  onBowShot?: () => void
  onEat?: () => void
}

/** Player offense: sword swings, bow charging, food. */
export class CombatSystem {
  /** Remaining swing animation time (held-item view reads this). */
  swingTime = 0
  /** Bow charge 0..1 while drawing, -1 when idle. */
  bowCharge = -1
  /** Extra targets beyond mobs (crystals, the dragon). */
  readonly hittables: Hittable[] = []
  /** Set briefly after a melee hit so block breaking doesn't double-trigger. */
  suppressBreaking = 0
  events: CombatEvents = {}
  private meleeCooldown = 0
  private prevRightDown = false

  constructor(
    private readonly player: PlayerController,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly input: InputManager,
    private readonly inventory: Inventory,
    private readonly projectiles: Projectiles,
    private readonly effects: ParticleEffects,
  ) {}

  update(dt: number, mobs: readonly Mob[]): void {
    this.swingTime = Math.max(0, this.swingTime - dt)
    this.meleeCooldown = Math.max(0, this.meleeCooldown - dt)
    this.suppressBreaking = Math.max(0, this.suppressBreaking - dt)

    const slot = this.inventory.selectedSlot
    if (slot.kind === 'sword') this.updateSword(mobs)
    else if (slot.kind === 'bow') this.updateBow(dt)
    else this.bowCharge = -1
    if (slot.kind !== 'bow') this.prevRightDown = false

    if (slot.kind === 'food' && this.input.wasClicked(2)) this.tryEat()
  }

  private updateSword(mobs: readonly Mob[]): void {
    if (!this.input.wasClicked(0) || this.meleeCooldown > 0) return
    this.swingTime = 0.28
    this.meleeCooldown = MELEE_COOLDOWN

    const eye = this.player.eyePosition
    const dir = this.camera.getWorldDirection(new THREE.Vector3())

    let best: Mob | null = null
    let bestDist = Infinity
    for (const mob of mobs) {
      if (mob.dead) continue
      const center = mob.position.clone()
      center.y += mob.height / 2
      const to = center.sub(eye)
      const dist = to.length()
      if (dist > MELEE_RANGE + mob.width) continue
      if (to.normalize().dot(dir) < 0.6) continue
      if (dist < bestDist) {
        best = mob
        bestDist = dist
      }
    }

    let bestHittable: Hittable | null = null
    for (const h of this.hittables) {
      if (!h.alive) continue
      const to = h.position.clone().sub(eye)
      const dist = to.length()
      if (dist > MELEE_RANGE + h.hitRadius) continue
      if (to.normalize().dot(dir) < 0.55) continue
      if (dist < bestDist) {
        bestHittable = h
        bestDist = dist
        best = null
      }
    }

    const knock = new THREE.Vector3(dir.x, 0, dir.z).normalize()
    if (best) {
      best.damage(MELEE_DAMAGE, knock)
      this.suppressBreaking = 0.3
      this.events.onMeleeHit?.()
    } else if (bestHittable) {
      bestHittable.takeHit(MELEE_DAMAGE, knock)
      this.suppressBreaking = 0.3
      this.events.onMeleeHit?.()
    }
  }

  private updateBow(dt: number): void {
    const down = this.input.isButtonDown(2)
    if (down) {
      this.bowCharge = this.bowCharge < 0 ? 0 : Math.min(1, this.bowCharge + dt / 0.9)
    } else {
      if (this.prevRightDown && this.bowCharge >= BOW_MIN_CHARGE) {
        const dir = this.camera.getWorldDirection(new THREE.Vector3())
        const origin = this.player.eyePosition.addScaledVector(dir, 0.4)
        this.projectiles.spawnArrow(origin, dir, 'player', 16 + this.bowCharge * 22)
        this.events.onBowShot?.()
      }
      this.bowCharge = -1
    }
    this.prevRightDown = down
  }

  private tryEat(): void {
    if (this.player.hp >= this.player.maxHp) return
    if (!this.inventory.eatFood()) return
    this.player.heal(EAT_HEAL)
    const p = this.player.position
    this.effects.heal(p.x, p.y + 1, p.z)
    this.swingTime = 0.2
    this.events.onEat?.()
  }
}
