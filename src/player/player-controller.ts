import * as THREE from 'three'
import type { InputManager } from '../core/input-manager'
import { clamp } from '../core/math-utils'
import type { World } from '../world/world'
import { isBodyInWater, isEyeInWater, moveBody, type PhysicsBody } from './voxel-physics'

const GRAVITY = 28
const WATER_GRAVITY = 8
const JUMP_SPEED = 9
const WALK_SPEED = 4.4
const SPRINT_SPEED = 6.2
const WATER_SPEED = 2.4
const GROUND_ACCEL = 10
const AIR_ACCEL = 3.5
export const EYE_HEIGHT = 1.62

/** First-person player: look, walk, jump, swim, take damage. */
export class PlayerController implements PhysicsBody {
  readonly position = new THREE.Vector3()
  readonly velocity = new THREE.Vector3()
  readonly width = 0.6
  readonly height = 1.8
  onGround = false
  inWater = false
  eyeInWater = false
  yaw = 0
  pitch = 0
  hp = 20
  readonly maxHp = 20
  /** Seconds of invulnerability remaining after a hit. */
  invulnerable = 0
  /** Seconds since last damage, drives passive regen. */
  timeSinceDamage = 0
  /** Peak downward speed while airborne; converted to damage on landing. */
  private peakFallSpeed = 0
  /** True while sprint movement is active; drives the FOV kick. */
  sprinting = false
  onDamaged: ((amount: number, source: string) => void) | null = null
  onDied: ((source: string) => void) | null = null
  /** Fired on touchdown with meaningful fall speed (camera thud). */
  onHardLanding: ((speed: number) => void) | null = null

  constructor(
    private readonly world: World,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly input: InputManager,
  ) {}

  spawnAt(wx: number, wz: number): void {
    const y = this.world.terrain.heightAt(wx, wz) + 1
    this.position.set(wx + 0.5, y + 0.2, wz + 0.5)
    this.velocity.set(0, 0, 0)
    this.hp = this.maxHp
    this.invulnerable = 0
    this.timeSinceDamage = 999
    this.peakFallSpeed = 0
    this.onGround = false
  }

  get eyePosition(): THREE.Vector3 {
    return new THREE.Vector3(
      this.position.x,
      this.position.y + EYE_HEIGHT,
      this.position.z,
    )
  }

  update(dt: number): void {
    this.look()
    this.inWater = isBodyInWater(this.world, this)
    this.eyeInWater = isEyeInWater(this.world, this, EYE_HEIGHT)
    this.move(dt)

    const wasGrounded = this.onGround
    const fallingSpeed = -this.velocity.y
    moveBody(this.world, this, dt)
    if (!this.onGround) {
      this.peakFallSpeed = Math.max(this.peakFallSpeed, fallingSpeed)
      if (this.inWater) this.peakFallSpeed = 0
    } else {
      if (!wasGrounded && this.peakFallSpeed > 9 && !this.inWater) {
        this.onHardLanding?.(this.peakFallSpeed)
      }
      if (!wasGrounded && this.peakFallSpeed > 14 && !this.inWater) {
        this.damage(Math.ceil((this.peakFallSpeed - 13) * 0.7), 'fall')
      }
      this.peakFallSpeed = 0
    }

    this.invulnerable = Math.max(0, this.invulnerable - dt)
    this.timeSinceDamage += dt
    if (this.timeSinceDamage > 8 && this.hp > 0 && this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + dt * 0.6)
    }

    this.syncCamera()
  }

  private look(): void {
    const [mx, my] = this.input.consumeMouseDelta()
    this.yaw -= mx * 0.0022
    this.pitch = clamp(this.pitch - my * 0.0022, -1.55, 1.55)
  }

  private move(dt: number): void {
    const input = this.input
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw))
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw))
    const wish = new THREE.Vector3()
    if (input.isDown('KeyW')) wish.add(forward)
    if (input.isDown('KeyS')) wish.sub(forward)
    if (input.isDown('KeyD')) wish.add(right)
    if (input.isDown('KeyA')) wish.sub(right)
    if (wish.lengthSq() > 0) wish.normalize()

    const moving = wish.lengthSq() > 0
    this.sprinting = input.isDown('ShiftLeft') && !this.inWater && moving
    const maxSpeed = this.inWater ? WATER_SPEED : this.sprinting ? SPRINT_SPEED : WALK_SPEED
    const accel = this.onGround || this.inWater ? GROUND_ACCEL : AIR_ACCEL

    const blend = 1 - Math.exp(-accel * dt)
    this.velocity.x += (wish.x * maxSpeed - this.velocity.x) * blend
    this.velocity.z += (wish.z * maxSpeed - this.velocity.z) * blend

    if (this.inWater) {
      this.velocity.y -= WATER_GRAVITY * dt
      this.velocity.y *= 1 - Math.exp(-3 * dt)
      if (input.isDown('Space')) this.velocity.y = 4
    } else {
      this.velocity.y -= GRAVITY * dt
      if (input.isDown('Space') && this.onGround) this.velocity.y = JUMP_SPEED
    }
  }

  private syncCamera(): void {
    const eye = this.eyePosition
    this.camera.position.copy(eye)
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ')
  }

  damage(amount: number, source: string): void {
    if (this.hp <= 0 || this.invulnerable > 0) return
    this.hp = Math.max(0, this.hp - amount)
    this.invulnerable = 0.5
    this.timeSinceDamage = 0
    this.onDamaged?.(amount, source)
    if (this.hp <= 0) this.onDied?.(source)
  }

  heal(amount: number): void {
    if (this.hp <= 0) return
    this.hp = Math.min(this.maxHp, this.hp + amount)
  }
}
