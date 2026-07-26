import * as THREE from 'three'
import { Block } from '../world/block-registry'

const POOL_SIZE = 1024

const VERTEX_SHADER = `
attribute float size;
attribute float alpha;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vColor = color;
  vAlpha = alpha;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * (240.0 / -mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;
}
`

const FRAGMENT_SHADER = `
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 d = gl_PointCoord - vec2(0.5);
  if (dot(d, d) > 0.25) discard;
  gl_FragColor = vec4(vColor, vAlpha);
}
`

interface SpawnOptions {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  color: number
  size: number
  life: number
  gravity: number
  drag?: number
}

/** Fixed-size ring-buffer particle pool rendered as a single Points draw. */
class ParticlePool {
  private readonly positions = new Float32Array(POOL_SIZE * 3)
  private readonly velocities = new Float32Array(POOL_SIZE * 3)
  private readonly colors = new Float32Array(POOL_SIZE * 3)
  private readonly sizes = new Float32Array(POOL_SIZE)
  private readonly alphas = new Float32Array(POOL_SIZE)
  private readonly life = new Float32Array(POOL_SIZE)
  private readonly maxLife = new Float32Array(POOL_SIZE)
  private readonly gravity = new Float32Array(POOL_SIZE)
  private readonly drag = new Float32Array(POOL_SIZE)
  private head = 0
  private readonly geometry: THREE.BufferGeometry
  private readonly tmpColor = new THREE.Color()

  constructor(scene: THREE.Scene, blending: THREE.Blending) {
    this.geometry = new THREE.BufferGeometry()
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3))
    this.geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1))
    this.geometry.setAttribute('alpha', new THREE.BufferAttribute(this.alphas, 1))
    // Particles are scattered around the player; skip per-frame culling math.
    this.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6)
    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending,
    })
    const points = new THREE.Points(this.geometry, material)
    points.frustumCulled = false
    scene.add(points)
  }

  spawn(opts: SpawnOptions): void {
    const i = this.head
    this.head = (this.head + 1) % POOL_SIZE
    this.positions[i * 3] = opts.x
    this.positions[i * 3 + 1] = opts.y
    this.positions[i * 3 + 2] = opts.z
    this.velocities[i * 3] = opts.vx
    this.velocities[i * 3 + 1] = opts.vy
    this.velocities[i * 3 + 2] = opts.vz
    this.tmpColor.setHex(opts.color)
    this.colors[i * 3] = this.tmpColor.r
    this.colors[i * 3 + 1] = this.tmpColor.g
    this.colors[i * 3 + 2] = this.tmpColor.b
    this.sizes[i] = opts.size
    this.life[i] = opts.life
    this.maxLife[i] = opts.life
    this.gravity[i] = opts.gravity
    this.drag[i] = opts.drag ?? 0
    this.alphas[i] = 1
  }

  update(dt: number): void {
    for (let i = 0; i < POOL_SIZE; i++) {
      if (this.life[i] as number <= 0) continue
      this.life[i] = (this.life[i] as number) - dt
      if ((this.life[i] as number) <= 0) {
        this.alphas[i] = 0
        continue
      }
      const damp = 1 - Math.exp(-(this.drag[i] as number) * dt)
      this.velocities[i * 3] = (this.velocities[i * 3] as number) * (1 - damp)
      this.velocities[i * 3 + 1] =
        (this.velocities[i * 3 + 1] as number) * (1 - damp) - (this.gravity[i] as number) * dt
      this.velocities[i * 3 + 2] = (this.velocities[i * 3 + 2] as number) * (1 - damp)
      this.positions[i * 3] = (this.positions[i * 3] as number) + (this.velocities[i * 3] as number) * dt
      this.positions[i * 3 + 1] =
        (this.positions[i * 3 + 1] as number) + (this.velocities[i * 3 + 1] as number) * dt
      this.positions[i * 3 + 2] =
        (this.positions[i * 3 + 2] as number) + (this.velocities[i * 3 + 2] as number) * dt
      this.alphas[i] = (this.life[i] as number) / (this.maxLife[i] as number)
    }
    this.geometry.getAttribute('position').needsUpdate = true
    this.geometry.getAttribute('alpha').needsUpdate = true
    this.geometry.getAttribute('color').needsUpdate = true
    this.geometry.getAttribute('size').needsUpdate = true
  }
}

/** Approximate debris color per block id. */
const BLOCK_COLORS: Readonly<Record<number, number>> = {
  [Block.GRASS]: 0x6aa940,
  [Block.DIRT]: 0x866043,
  [Block.STONE]: 0x7d7d7d,
  [Block.COBBLESTONE]: 0x6e6e6e,
  [Block.SAND]: 0xdbcfa3,
  [Block.SNOW]: 0xf0f6fa,
  [Block.WATER]: 0x2f5dc5,
  [Block.LOG]: 0x6b5435,
  [Block.LEAVES]: 0x3a7927,
  [Block.PLANKS]: 0xa88556,
  [Block.OBSIDIAN]: 0x2a2140,
  [Block.CRYSTAL_BLOCK]: 0xd23ce6,
  [Block.GLOWSTONE]: 0xfad778,
  [Block.FLOWER_RED]: 0xd63030,
  [Block.FLOWER_YELLOW]: 0xf4d03e,
  [Block.TALL_GRASS]: 0x549838,
}

/** High-level effect presets over two blended pools. */
export class ParticleEffects {
  private readonly solid: ParticlePool
  private readonly glow: ParticlePool

  constructor(scene: THREE.Scene) {
    this.solid = new ParticlePool(scene, THREE.NormalBlending)
    this.glow = new ParticlePool(scene, THREE.AdditiveBlending)
  }

  update(dt: number): void {
    this.solid.update(dt)
    this.glow.update(dt)
  }

  blockBreak(x: number, y: number, z: number, blockId: number): void {
    const color = BLOCK_COLORS[blockId] ?? 0x909090
    for (let i = 0; i < 18; i++) {
      this.solid.spawn({
        x: x + 0.5 + (Math.random() - 0.5) * 0.7,
        y: y + 0.5 + (Math.random() - 0.5) * 0.7,
        z: z + 0.5 + (Math.random() - 0.5) * 0.7,
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 4 + 1,
        vz: (Math.random() - 0.5) * 4,
        color,
        size: 0.6 + Math.random() * 0.5,
        life: 0.5 + Math.random() * 0.4,
        gravity: 14,
      })
    }
  }

  flame(x: number, y: number, z: number, vx = 0, vy = 2, vz = 0): void {
    const hot = Math.random()
    this.glow.spawn({
      x, y, z,
      vx: vx + (Math.random() - 0.5) * 1.2,
      vy: vy + Math.random() * 1.5,
      vz: vz + (Math.random() - 0.5) * 1.2,
      color: hot > 0.6 ? 0xffdd55 : hot > 0.25 ? 0xff8822 : 0xe83a10,
      size: 1.4 + Math.random() * 1.4,
      life: 0.35 + Math.random() * 0.4,
      gravity: -3,
      drag: 1.5,
    })
  }

  smoke(x: number, y: number, z: number): void {
    this.solid.spawn({
      x: x + (Math.random() - 0.5) * 0.6,
      y,
      z: z + (Math.random() - 0.5) * 0.6,
      vx: (Math.random() - 0.5) * 0.8,
      vy: 1.4 + Math.random(),
      vz: (Math.random() - 0.5) * 0.8,
      color: 0x3c3c40,
      size: 1.6 + Math.random() * 1.6,
      life: 0.9 + Math.random() * 0.8,
      gravity: -1,
      drag: 1,
    })
  }

  explosion(x: number, y: number, z: number, scale = 1): void {
    for (let i = 0; i < 46; i++) {
      const dir = new THREE.Vector3().randomDirection()
      const speed = (3 + Math.random() * 9) * scale
      this.glow.spawn({
        x, y, z,
        vx: dir.x * speed,
        vy: Math.abs(dir.y) * speed * 0.8,
        vz: dir.z * speed,
        color: Math.random() > 0.5 ? 0xffcc44 : 0xff6a1a,
        size: (1.6 + Math.random() * 2) * scale,
        life: 0.4 + Math.random() * 0.5,
        gravity: 6,
        drag: 2,
      })
    }
    for (let i = 0; i < 18; i++) this.smoke(x, y + 0.4, z)
  }

  heal(x: number, y: number, z: number): void {
    for (let i = 0; i < 8; i++) {
      this.glow.spawn({
        x: x + (Math.random() - 0.5) * 1.4,
        y: y + Math.random() * 1.6,
        z: z + (Math.random() - 0.5) * 1.4,
        vx: 0,
        vy: 1.6 + Math.random(),
        vz: 0,
        color: 0x54e87a,
        size: 0.9,
        life: 0.7,
        gravity: -1,
      })
    }
  }
}
