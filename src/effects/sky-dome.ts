import * as THREE from 'three'
import { mulberry32 } from '../core/math-utils'

/**
 * Sky backdrop pieces: gradient dome with sun glow, drifting blocky clouds
 * and twinkling stars. All textures are generated procedurally.
 */

const DOME_RADIUS = 430
const CLOUD_HEIGHT = 84
const CLOUD_PLANE_SIZE = 900
/** World units covered by one repeat of the cloud texture. */
const CLOUD_TILE = 300
const CLOUD_DRIFT = 1.6

/** Blocky Minecraft-style cloud pattern from thresholded value noise. */
function buildCloudTexture(seed: number): THREE.CanvasTexture {
  const size = 128
  const cell = 2
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2d context unavailable')

  const rng = mulberry32(seed)
  const grid = 16
  const noise: number[] = []
  for (let i = 0; i < grid * grid; i++) noise.push(rng())
  const at = (x: number, y: number) =>
    noise[((y & (grid - 1)) * grid + (x & (grid - 1))) % noise.length] as number
  const smooth = (x: number, y: number) => {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const fx = x - xi
    const fy = y - yi
    const a = at(xi, yi)
    const b = at(xi + 1, yi)
    const c = at(xi, yi + 1)
    const d = at(xi + 1, yi + 1)
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy
  }

  ctx.clearRect(0, 0, size, size)
  ctx.fillStyle = '#ffffff'
  for (let y = 0; y < size / cell; y++) {
    for (let x = 0; x < size / cell; x++) {
      // Two octaves, wrapped so the texture tiles seamlessly.
      const u = (x * cell) / size
      const v = (y * cell) / size
      const n = smooth(u * grid, v * grid) * 0.65 + smooth(u * grid * 2, v * grid * 2) * 0.35
      if (n > 0.58) ctx.fillRect(x * cell, y * cell, cell, cell)
    }
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(CLOUD_PLANE_SIZE / CLOUD_TILE, CLOUD_PLANE_SIZE / CLOUD_TILE)
  return texture
}

/** Gradient dome + sun glow, drawn behind everything else. */
export class SkyDome {
  readonly mesh: THREE.Mesh
  private readonly uniforms: {
    uZenith: { value: THREE.Color }
    uHorizon: { value: THREE.Color }
    uSunDir: { value: THREE.Vector3 }
    uGlow: { value: THREE.Color }
    uGlowStrength: { value: number }
  }
  private readonly clouds: THREE.Mesh
  private readonly cloudMaterial: THREE.MeshBasicMaterial
  private readonly cloudTexture: THREE.CanvasTexture
  private drift = 0

  constructor(scene: THREE.Scene, seed = 7) {
    this.uniforms = {
      uZenith: { value: new THREE.Color(0x87b8e8) },
      uHorizon: { value: new THREE.Color(0xc4d8ee) },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uGlow: { value: new THREE.Color(1.6, 1.2, 0.75) },
      uGlowStrength: { value: 1 },
    }
    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uZenith;
        uniform vec3 uHorizon;
        uniform vec3 uSunDir;
        uniform vec3 uGlow;
        uniform float uGlowStrength;
        varying vec3 vDir;
        void main() {
          vec3 dir = normalize(vDir);
          float h = clamp(dir.y, 0.0, 1.0);
          vec3 col = mix(uHorizon, uZenith, pow(h, 0.55));
          float s = max(dot(dir, uSunDir), 0.0);
          col += uGlow * (pow(s, 48.0) * 1.1 + pow(s, 6.0) * 0.22) * uGlowStrength;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    })
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(DOME_RADIUS, 24, 12), material)
    this.mesh.renderOrder = -100
    this.mesh.frustumCulled = false
    scene.add(this.mesh)

    this.cloudTexture = buildCloudTexture(seed)
    this.cloudMaterial = new THREE.MeshBasicMaterial({
      map: this.cloudTexture,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    this.clouds = new THREE.Mesh(
      new THREE.PlaneGeometry(CLOUD_PLANE_SIZE, CLOUD_PLANE_SIZE),
      this.cloudMaterial,
    )
    this.clouds.rotation.x = -Math.PI / 2
    this.clouds.position.y = CLOUD_HEIGHT
    this.clouds.renderOrder = -50
    scene.add(this.clouds)
  }

  setVisible(visible: boolean): void {
    this.mesh.visible = visible
    this.clouds.visible = visible
  }

  update(
    dt: number,
    focus: THREE.Vector3,
    sunDir: THREE.Vector3,
    zenith: THREE.Color,
    horizon: THREE.Color,
    glowStrength: number,
    lightLevel: number,
  ): void {
    this.drift += dt * CLOUD_DRIFT
    this.mesh.position.copy(focus)
    this.uniforms.uZenith.value.copy(zenith)
    this.uniforms.uHorizon.value.copy(horizon)
    this.uniforms.uSunDir.value.copy(sunDir)
    this.uniforms.uGlowStrength.value = glowStrength

    // Plane follows the player while the texture offset keeps the pattern
    // anchored to world space, plus a slow eastward drift.
    this.clouds.position.set(focus.x, CLOUD_HEIGHT, focus.z)
    this.cloudTexture.offset.set((focus.x + this.drift) / CLOUD_TILE, focus.z / CLOUD_TILE)
    this.cloudMaterial.opacity = 0.18 + lightLevel * 0.38
    // Clouds dim with the sky so night cover reads as faint silhouettes.
    this.cloudMaterial.color.setScalar(0.2 + lightLevel * 0.8)
  }
}

/** Star field whose points twinkle individually. */
export function buildTwinkleStars(seed: number): {
  points: THREE.Points
  uniforms: { uTime: { value: number }; uOpacity: { value: number } }
} {
  const rng = mulberry32(seed)
  const positions: number[] = []
  const phases: number[] = []
  for (let i = 0; i < 420; i++) {
    const v = new THREE.Vector3(rng() * 2 - 1, rng(), rng() * 2 - 1)
      .normalize()
      .multiplyScalar(DOME_RADIUS)
    positions.push(v.x, v.y, v.z)
    phases.push(rng() * Math.PI * 2)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('phase', new THREE.Float32BufferAttribute(phases, 1))

  const uniforms = { uTime: { value: 0 }, uOpacity: { value: 0 } }
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      uniform float uTime;
      attribute float phase;
      varying float vTwinkle;
      void main() {
        vTwinkle = 0.55 + 0.45 * sin(uTime * 1.8 + phase * 3.0);
        gl_PointSize = 1.2 + 1.4 * vTwinkle;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying float vTwinkle;
      void main() {
        gl_FragColor = vec4(vec3(1.0), uOpacity * vTwinkle);
      }
    `,
  })
  const points = new THREE.Points(geometry, material)
  points.renderOrder = -90
  return { points, uniforms }
}
