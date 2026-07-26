import * as THREE from 'three'
import { lerp, mulberry32 } from '../core/math-utils'

/** Full day-night cycle length in real seconds. */
export const DAY_LENGTH = 480

interface SkyKey {
  t: number
  sky: number
  fog: number
  ambient: number
  sun: number
}

// Midnight → sunrise → noon → sunset → midnight.
const KEYS: readonly SkyKey[] = [
  { t: 0.0, sky: 0x070b1e, fog: 0x0a1026, ambient: 0.5, sun: 0.0 },
  { t: 0.22, sky: 0x11172e, fog: 0x1a2036, ambient: 0.55, sun: 0.0 },
  { t: 0.27, sky: 0x9db4d8, fog: 0xe8a06a, ambient: 0.9, sun: 0.9 },
  { t: 0.5, sky: 0x87b8e8, fog: 0xc4d8ee, ambient: 1.4, sun: 2.0 },
  { t: 0.73, sky: 0x8d7ab8, fog: 0xe87a4a, ambient: 0.9, sun: 0.8 },
  { t: 0.78, sky: 0x11172e, fog: 0x1a2036, ambient: 0.55, sun: 0.0 },
  { t: 1.0, sky: 0x070b1e, fog: 0x0a1026, ambient: 0.5, sun: 0.0 },
]

const UNDERWATER_FOG = new THREE.Color(0x1a3a7a)

/** Sun, moon, stars, fog and light animation driven by time of day. */
export class Sky {
  /** 0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset. */
  timeOfDay = 0.32
  private readonly sunLight: THREE.DirectionalLight
  private readonly ambientLight: THREE.AmbientLight
  private readonly sunMesh: THREE.Mesh
  private readonly moonMesh: THREE.Mesh
  private readonly stars: THREE.Points
  private readonly starsMaterial: THREE.PointsMaterial
  private readonly skyColor = new THREE.Color()
  private readonly fogColor = new THREE.Color()

  constructor(private readonly scene: THREE.Scene) {
    this.sunLight = new THREE.DirectionalLight(0xfff4e0, 2)
    this.ambientLight = new THREE.AmbientLight(0xb8c8e8, 1.2)
    scene.add(this.sunLight, this.sunLight.target, this.ambientLight)

    this.sunMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(42, 42),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8, fog: false }),
    )
    this.moonMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 30),
      new THREE.MeshBasicMaterial({ color: 0xdfe6f2, fog: false }),
    )
    scene.add(this.sunMesh, this.moonMesh)

    const starRng = mulberry32(99)
    const starPositions: number[] = []
    for (let i = 0; i < 420; i++) {
      const v = new THREE.Vector3(
        starRng() * 2 - 1,
        starRng(),
        starRng() * 2 - 1,
      ).normalize().multiplyScalar(430)
      starPositions.push(v.x, v.y, v.z)
    }
    const starGeometry = new THREE.BufferGeometry()
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3))
    this.starsMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.6,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0,
      fog: false,
    })
    this.stars = new THREE.Points(starGeometry, this.starsMaterial)
    scene.add(this.stars)
  }

  /** Sun elevation in [-1, 1]; positive during the day. */
  get sunElevation(): number {
    return Math.sin((this.timeOfDay - 0.25) * Math.PI * 2)
  }

  isNight(): boolean {
    return this.sunElevation < -0.06
  }

  /** 0 at deep night → 1 at noon; drives mob spawn logic and HUD tinting. */
  lightLevel(): number {
    return THREE.MathUtils.clamp(this.sunElevation * 1.6 + 0.5, 0.05, 1)
  }

  private sample(field: (k: SkyKey) => number): number {
    const t = this.timeOfDay
    for (let i = 0; i < KEYS.length - 1; i++) {
      const a = KEYS[i] as SkyKey
      const b = KEYS[i + 1] as SkyKey
      if (t >= a.t && t <= b.t) {
        const f = (t - a.t) / (b.t - a.t)
        return lerp(field(a), field(b), f)
      }
    }
    return field(KEYS[0] as SkyKey)
  }

  private sampleColor(target: THREE.Color, field: (k: SkyKey) => number): void {
    const t = this.timeOfDay
    for (let i = 0; i < KEYS.length - 1; i++) {
      const a = KEYS[i] as SkyKey
      const b = KEYS[i + 1] as SkyKey
      if (t >= a.t && t <= b.t) {
        const f = (t - a.t) / (b.t - a.t)
        target.setHex(field(a)).lerp(new THREE.Color(field(b)), f)
        return
      }
    }
    target.setHex(field(KEYS[0] as SkyKey))
  }

  update(dt: number, focus: THREE.Vector3, eyeInWater: boolean): void {
    this.timeOfDay = (this.timeOfDay + dt / DAY_LENGTH) % 1

    const angle = (this.timeOfDay - 0.25) * Math.PI * 2
    const sunDir = new THREE.Vector3(Math.cos(angle) * 0.55, Math.sin(angle), 0.35).normalize()

    this.sunLight.position.copy(focus).addScaledVector(sunDir, 120)
    this.sunLight.target.position.copy(focus)
    this.sunMesh.position.copy(focus).addScaledVector(sunDir, 400)
    this.sunMesh.lookAt(focus)
    this.moonMesh.position.copy(focus).addScaledVector(sunDir, -400)
    this.moonMesh.lookAt(focus)
    this.stars.position.copy(focus)

    this.sampleColor(this.skyColor, (k) => k.sky)
    this.sampleColor(this.fogColor, (k) => k.fog)
    this.ambientLight.intensity = this.sample((k) => k.ambient)
    this.sunLight.intensity = this.sample((k) => k.sun)

    const nightFactor = THREE.MathUtils.clamp(-this.sunElevation * 4, 0, 1)
    this.starsMaterial.opacity = nightFactor * 0.9

    const fog = this.scene.fog as THREE.Fog | null
    if (eyeInWater) {
      this.scene.background = UNDERWATER_FOG
      if (fog) {
        fog.color.copy(UNDERWATER_FOG)
        fog.near = 2
        fog.far = 24
      }
    } else {
      const bg = this.scene.background as THREE.Color | null
      if (bg) bg.copy(this.skyColor)
      else this.scene.background = this.skyColor.clone()
      if (fog) {
        fog.color.copy(this.fogColor)
        fog.near = 60
        fog.far = 150
      }
    }
  }
}
