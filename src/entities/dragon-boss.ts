import * as THREE from 'three'
import type { FireZones } from '../combat/fire-zones'
import type { Hittable, Projectiles } from '../combat/projectiles'
import { clamp } from '../core/math-utils'
import type { ParticleEffects } from '../effects/particles'
import type { PlayerController } from '../player/player-controller'
import { ARENA_Y, LAIR_CENTER_X, LAIR_CENTER_Z, LAIR_RADIUS } from '../world/lair-generator'
import type { CrystalManager } from './crystal-towers'
import { buildDragonRig, type DragonRig } from './dragon-model'

export type DragonState =
  | 'perched'
  | 'takeoff'
  | 'circling'
  | 'swoop'
  | 'fireball'
  | 'flamebreath'
  | 'dying'
  | 'dead'

export interface DragonEvents {
  onRoar?: () => void
  onFireball?: () => void
  onBreathStart?: () => void
  onHurt?: () => void
  onDeath?: () => void
}

const CENTER = new THREE.Vector3(LAIR_CENTER_X, 0, LAIR_CENTER_Z)
const MAX_HP = 300
const ACTIVATION_RANGE = 70

/** The fire-breathing lair boss. */
export class DragonBoss implements Hittable {
  readonly hitRadius = 3.5
  alive = true
  hp = MAX_HP
  readonly maxHp = MAX_HP
  state: DragonState = 'perched'
  events: DragonEvents = {}

  private readonly rig: DragonRig
  private stateTime = 0
  private animTime = 0
  private readonly forward = new THREE.Vector3(0, 0, -1)
  private orbitAngle = 0
  private readonly swoopTarget = new THREE.Vector3()
  private fireballsLeft = 0
  private attackTimer = 0
  private hurtFlash = 0
  private bank = 0

  constructor(
    private readonly scene: THREE.Scene,
    map: THREE.Texture,
    private readonly projectiles: Projectiles,
    private readonly fireZones: FireZones,
    private readonly effects: ParticleEffects,
    private readonly crystals: CrystalManager,
  ) {
    this.rig = buildDragonRig(map)
    this.rig.root.position.set(LAIR_CENTER_X, ARENA_Y + 4.3, LAIR_CENTER_Z)
    scene.add(this.rig.root)
  }

  get position(): THREE.Vector3 {
    return this.rig.root.position
  }

  /** True while airborne and targetable (drives crystal beams + boss bar). */
  get engaged(): boolean {
    return this.state !== 'perched' && this.state !== 'dead' && this.state !== 'dying'
  }

  get defeated(): boolean {
    return this.state === 'dead'
  }

  takeHit(amount: number, _dir: THREE.Vector3): void {
    if (this.state === 'dying' || this.state === 'dead') return
    // Crystals shield the dragon: destroy them first for full damage.
    const effective = this.crystals.aliveCount > 0 ? amount * 0.5 : amount
    this.hp -= effective
    this.hurtFlash = 0.3
    this.events.onHurt?.()
    if (this.state === 'perched') this.enterState('takeoff')
    if (this.hp <= 0) {
      this.alive = false
      this.enterState('dying')
    }
  }

  private enterState(state: DragonState): void {
    this.state = state
    this.stateTime = 0
    if (state === 'takeoff') this.events.onRoar?.()
    if (state === 'fireball') {
      this.fireballsLeft = 2 + Math.floor(Math.random() * 2)
      this.attackTimer = 0.4
    }
    if (state === 'flamebreath') {
      this.attackTimer = 0
      this.events.onBreathStart?.()
    }
  }

  update(dt: number, player: PlayerController): void {
    if (this.state === 'dead') return
    this.animTime += dt
    this.stateTime += dt
    this.hurtFlash = Math.max(0, this.hurtFlash - dt)
    const tint = this.hurtFlash > 0 ? 0.5 : 0
    this.rig.material.color.setRGB(1, 1 - tint, 1 - tint)

    // Crystal healing while airborne and hurt.
    if (this.engaged && this.crystals.aliveCount > 0 && this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + 3 * dt)
      if (Math.random() < 2 * dt) {
        this.effects.heal(this.position.x, this.position.y + 1, this.position.z)
      }
    }

    const playerEye = player.eyePosition
    switch (this.state) {
      case 'perched':
        this.updatePerched(player)
        break
      case 'takeoff':
        this.updateTakeoff(dt)
        break
      case 'circling':
        this.updateCircling(dt, player)
        break
      case 'swoop':
        this.updateSwoop(dt, player)
        break
      case 'fireball':
        this.updateFireball(dt, playerEye)
        break
      case 'flamebreath':
        this.updateFlamebreath(dt, player)
        break
      case 'dying':
        this.updateDying(dt)
        break
    }

    this.applyPose(player)
  }

  private updatePerched(player: PlayerController): void {
    const d = player.position.distanceTo(this.position)
    if (d < ACTIVATION_RANGE) this.enterState('takeoff')
  }

  private updateTakeoff(dt: number): void {
    this.position.y += 7 * dt
    this.forward.set(0, 0.35, -1).normalize()
    if (this.position.y > ARENA_Y + 16) {
      this.orbitAngle = Math.atan2(
        this.position.z - CENTER.z,
        this.position.x - CENTER.x,
      )
      this.enterState('circling')
    }
  }

  private updateCircling(dt: number, player: PlayerController): void {
    this.orbitAngle += dt * 0.5
    const radius = 21
    const target = new THREE.Vector3(
      CENTER.x + Math.cos(this.orbitAngle) * radius,
      ARENA_Y + 15 + Math.sin(this.animTime * 0.6) * 2.5,
      CENTER.z + Math.sin(this.orbitAngle) * radius,
    )
    this.steerToward(target, 11, 2.4, dt)

    if (this.stateTime > 4.5 + Math.random() * 3) {
      const playerInArena =
        Math.hypot(player.position.x - CENTER.x, player.position.z - CENTER.z) <
        LAIR_RADIUS + 8
      const roll = Math.random()
      if (!playerInArena || roll < 0.34) this.enterState('fireball')
      else if (roll < 0.67) {
        this.swoopTarget.copy(player.position)
        this.enterState('swoop')
      } else this.enterState('flamebreath')
    }
  }

  private updateSwoop(dt: number, player: PlayerController): void {
    // Light homing keeps the dive threatening without being unavoidable.
    this.swoopTarget.lerp(player.position, 1 - Math.exp(-1.2 * dt))
    const target = this.swoopTarget.clone()
    target.y += 1.2
    this.steerToward(target, 19, 3, dt)

    if (this.position.distanceTo(player.position) < 3.8) {
      player.damage(6, 'dragon')
      player.velocity.addScaledVector(this.forward, 13)
      player.velocity.y += 7
      this.enterState('circling')
      return
    }
    if (this.position.distanceTo(target) < 2.5 || this.stateTime > 4.5) {
      this.enterState('circling')
    }
    this.position.y = Math.max(this.position.y, ARENA_Y + 2.5)
  }

  private updateFireball(dt: number, playerEye: THREE.Vector3): void {
    // Hold a slow arc while lobbing fireballs from the mouth.
    this.orbitAngle += dt * 0.25
    const target = new THREE.Vector3(
      CENTER.x + Math.cos(this.orbitAngle) * 24,
      ARENA_Y + 14,
      CENTER.z + Math.sin(this.orbitAngle) * 24,
    )
    this.steerToward(target, 7, 2, dt)

    this.attackTimer -= dt
    if (this.attackTimer <= 0 && this.fireballsLeft > 0) {
      this.attackTimer = 0.8
      this.fireballsLeft--
      const mouthPos = this.rig.mouth.getWorldPosition(new THREE.Vector3())
      const dir = playerEye.clone().sub(mouthPos).normalize()
      this.projectiles.spawnFireball(mouthPos, dir, 18)
      this.events.onFireball?.()
    }
    if (this.fireballsLeft <= 0 && this.attackTimer < -0.4) this.enterState('circling')
  }

  private updateFlamebreath(dt: number, player: PlayerController): void {
    // Low strafing run over the player, hosing fire onto the ground.
    const target = player.position.clone()
    target.y = Math.max(player.position.y + 5, ARENA_Y + 6)
    this.steerToward(target, 9.5, 1.6, dt)

    const mouthPos = this.rig.mouth.getWorldPosition(new THREE.Vector3())
    const breathDir = this.forward.clone()
    breathDir.y -= 0.55
    breathDir.normalize()
    for (let i = 0; i < 3; i++) {
      this.effects.flame(
        mouthPos.x + breathDir.x * i * 0.8,
        mouthPos.y + breathDir.y * i * 0.8,
        mouthPos.z + breathDir.z * i * 0.8,
        breathDir.x * 9,
        breathDir.y * 9 + 1,
        breathDir.z * 9,
      )
    }

    this.attackTimer -= dt
    if (this.attackTimer <= 0) {
      this.attackTimer = 0.3
      this.fireZones.ignite(
        mouthPos.x + breathDir.x * 3 + (Math.random() - 0.5) * 2,
        mouthPos.z + breathDir.z * 3 + (Math.random() - 0.5) * 2,
      )
    }

    const toPlayer = player.eyePosition.sub(mouthPos)
    if (toPlayer.length() < 7 && toPlayer.normalize().dot(breathDir) > 0.55) {
      player.damage(2, 'dragon fire')
    }

    if (this.stateTime > 3.5) this.enterState('circling')
  }

  private updateDying(dt: number): void {
    this.orbitAngle += dt * 2.2
    const fall = Math.min(1, this.stateTime / 4)
    const radius = 12 * (1 - fall)
    this.position.set(
      CENTER.x + Math.cos(this.orbitAngle) * radius,
      Math.max(ARENA_Y + 2.5, this.position.y - 5 * dt),
      CENTER.z + Math.sin(this.orbitAngle) * radius,
    )
    this.forward
      .set(-Math.sin(this.orbitAngle), -0.2, Math.cos(this.orbitAngle))
      .normalize()

    if (Math.random() < 6 * dt) {
      this.effects.explosion(
        this.position.x + (Math.random() - 0.5) * 4,
        this.position.y + (Math.random() - 0.5) * 2,
        this.position.z + (Math.random() - 0.5) * 4,
        0.6,
      )
    }

    if (this.stateTime > 4.2) {
      this.state = 'dead'
      for (let i = 0; i < 3; i++) {
        this.effects.explosion(
          this.position.x + (Math.random() - 0.5) * 3,
          this.position.y + i * 1.5,
          this.position.z + (Math.random() - 0.5) * 3,
          2.2,
        )
      }
      this.scene.remove(this.rig.root)
      this.events.onDeath?.()
    }
  }

  private steerToward(target: THREE.Vector3, speed: number, turnRate: number, dt: number): void {
    const desired = target.clone().sub(this.position)
    if (desired.lengthSq() < 0.01) return
    desired.normalize()
    const before = Math.atan2(-this.forward.x, -this.forward.z)
    this.forward.lerp(desired, 1 - Math.exp(-turnRate * dt)).normalize()
    const after = Math.atan2(-this.forward.x, -this.forward.z)
    let turn = after - before
    if (turn > Math.PI) turn -= Math.PI * 2
    if (turn < -Math.PI) turn += Math.PI * 2
    this.bank += (clamp(turn / Math.max(dt, 1e-4) * 0.35, -0.65, 0.65) - this.bank) * (1 - Math.exp(-4 * dt))
    this.position.addScaledVector(this.forward, speed * dt)
  }

  private applyPose(player: PlayerController): void {
    const root = this.rig.root
    const yaw = Math.atan2(-this.forward.x, -this.forward.z)
    const pitch = Math.asin(clamp(this.forward.y, -1, 1))
    root.rotation.set(pitch, yaw, this.bank, 'YXZ')

    // Neck tracks the player.
    const toPlayer = player.eyePosition.sub(this.position)
    const desiredYaw = Math.atan2(-toPlayer.x, -toPlayer.z)
    let neckYaw = desiredYaw - yaw
    if (neckYaw > Math.PI) neckYaw -= Math.PI * 2
    if (neckYaw < -Math.PI) neckYaw += Math.PI * 2
    const horizontal = Math.hypot(toPlayer.x, toPlayer.z)
    const neckPitch = clamp(Math.atan2(toPlayer.y, horizontal) - pitch, -0.8, 0.8)

    const pose = {
      time: this.animTime,
      flapSpeed: 1.6,
      flapAmplitude: 0.6,
      neckPitch,
      neckYaw: clamp(neckYaw, -1.1, 1.1),
      jawOpen: 0,
      legsFolded: true,
    }
    switch (this.state) {
      case 'perched':
        pose.flapSpeed = 0.35
        pose.flapAmplitude = 0.07
        pose.legsFolded = false
        break
      case 'takeoff':
        pose.flapSpeed = 2.3
        pose.flapAmplitude = 0.8
        pose.jawOpen = this.stateTime < 1.2 ? 1 : 0.2
        break
      case 'swoop':
        pose.flapSpeed = 0.4
        pose.flapAmplitude = 0.15
        pose.jawOpen = 0.5
        break
      case 'fireball':
        pose.flapSpeed = 1.8
        pose.flapAmplitude = 0.5
        pose.jawOpen = this.attackTimer < 0.25 ? 0.9 : 0.2
        break
      case 'flamebreath':
        pose.flapSpeed = 1.4
        pose.flapAmplitude = 0.45
        pose.jawOpen = 1
        break
      case 'dying':
        pose.flapSpeed = 3
        pose.flapAmplitude = 0.9
        pose.jawOpen = 1
        break
      default:
        break
    }
    this.rig.animate(pose)
  }
}
