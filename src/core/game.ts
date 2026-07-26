import * as THREE from 'three'

/**
 * Game shell: owns the renderer, scene, camera and the frame loop.
 * Systems subscribe via onUpdate and receive a clamped delta time.
 */
export class Game {
  readonly renderer: THREE.WebGLRenderer
  readonly scene: THREE.Scene
  readonly camera: THREE.PerspectiveCamera
  /** Multiplies dt for gameplay systems; 0 while paused. */
  timeScale = 1
  /** Seconds since start, unaffected by pause (drives menus/sky shimmer). */
  elapsed = 0

  private readonly updatables: Array<(dt: number) => void> = []
  private readonly alwaysUpdatables: Array<(dt: number) => void> = []
  private lastTime = -1

  constructor(mount: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    mount.appendChild(this.renderer.domElement)

    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    )

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight
      this.camera.updateProjectionMatrix()
      this.renderer.setSize(window.innerWidth, window.innerHeight)
    })
  }

  /** Register a gameplay system update; receives dt scaled by timeScale. */
  onUpdate(fn: (dt: number) => void): void {
    this.updatables.push(fn)
  }

  /** Register an update that keeps running while paused (UI, sky). */
  onAlwaysUpdate(fn: (dt: number) => void): void {
    this.alwaysUpdatables.push(fn)
  }

  start(): void {
    this.renderer.setAnimationLoop((time) => this.frame(time / 1000))
  }

  private frame(time: number): void {
    if (this.lastTime < 0) this.lastTime = time
    // Clamp dt so tab-switch pauses cannot launch physics through walls.
    const rawDt = Math.min(time - this.lastTime, 0.05)
    this.lastTime = time
    this.elapsed += rawDt

    const dt = rawDt * this.timeScale
    if (dt > 0) {
      for (const fn of this.updatables) fn(dt)
    }
    for (const fn of this.alwaysUpdatables) fn(rawDt)

    this.renderer.render(this.scene, this.camera)
  }
}
