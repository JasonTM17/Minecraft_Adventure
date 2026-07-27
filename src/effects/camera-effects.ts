import type * as THREE from 'three'

const MAX_OFFSET = 0.055
const MAX_ROLL = 0.085
const TRAUMA_DECAY = 1.6
const SPRINT_FOV_BOOST = 7

/**
 * Trauma-based camera shake plus the sprint FOV kick. Applied every frame
 * AFTER the player controller writes the camera transform, adding decaying
 * offsets that are recomputed from scratch (never fed back into look state).
 */
export class CameraFx {
  sprinting = false
  private trauma = 0
  private time = 0
  private sprintLerp = 0
  private baseFov: number

  constructor(private readonly camera: THREE.PerspectiveCamera) {
    this.baseFov = camera.fov
  }

  /** Add shake intensity in [0, 1]; stacks and caps at full trauma. */
  addShake(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount)
  }

  /** Drop residual shake so a frozen frame (pause/death) sits level. */
  settle(): void {
    this.trauma = 0
    this.camera.rotation.z = 0
  }

  /** Update the base FOV; the sprint kick is applied on top. Applied live so
   *  the preview updates while the settings panel is open over a paused game. */
  setBaseFov(fov: number): void {
    this.baseFov = fov
    this.camera.fov = fov + this.sprintLerp * SPRINT_FOV_BOOST
    this.camera.updateProjectionMatrix()
  }

  update(dt: number): void {
    this.time += dt
    this.trauma = Math.max(0, this.trauma - TRAUMA_DECAY * dt)

    // Squared trauma reads as a sharp hit that settles quickly.
    const s = this.trauma * this.trauma
    if (s > 0.0001) {
      const t = this.time
      this.camera.position.x += Math.sin(t * 47.3) * MAX_OFFSET * s
      this.camera.position.y += Math.cos(t * 39.7) * MAX_OFFSET * s
      this.camera.rotation.z += Math.sin(t * 53.1) * MAX_ROLL * s
    }

    const target = this.sprinting ? 1 : 0
    this.sprintLerp += (target - this.sprintLerp) * (1 - Math.exp(-8 * dt))
    const fov = this.baseFov + this.sprintLerp * SPRINT_FOV_BOOST
    if (Math.abs(fov - this.camera.fov) > 0.01) {
      this.camera.fov = fov
      this.camera.updateProjectionMatrix()
    }
  }
}
