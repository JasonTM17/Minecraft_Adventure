import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'

/**
 * Game shell: owns the renderer, scene, camera and the frame loop.
 * Systems subscribe via onUpdate and receive a clamped delta time.
 */
export class Game {
  readonly renderer: THREE.WebGLRenderer
  readonly scene: THREE.Scene
  readonly camera: THREE.PerspectiveCamera
  private readonly composer: EffectComposer
  private readonly bloomPass: UnrealBloomPass
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
    // Filmic tone mapping: keeps bright fire/sun from clipping to flat white
    // and gives the bloom pass a real HDR range to threshold against.
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    mount.appendChild(this.renderer.domElement)

    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    )
    // Parent the camera so camera-attached objects (held item) render.
    this.scene.add(this.camera)

    this.composer = new EffectComposer(this.renderer)
    this.composer.addPass(new RenderPass(this.scene, this.camera))
    // Threshold sits above lit terrain (~1.4 linear at noon) so only truly
    // bright sources bloom: sun disk, flames, explosions, crystal beams.
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.55,
      0.4,
      1.45,
    )
    this.composer.addPass(this.bloomPass)
    // Tone mapping + sRGB conversion happen here when post-processing.
    this.composer.addPass(new OutputPass())

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight
      this.camera.updateProjectionMatrix()
      this.renderer.setSize(window.innerWidth, window.innerHeight)
      this.composer.setSize(window.innerWidth, window.innerHeight)
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

    this.composer.render()
  }
}
