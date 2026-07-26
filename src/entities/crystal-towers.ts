import * as THREE from 'three'
import type { Hittable } from '../combat/projectiles'
import type { ParticleEffects } from '../effects/particles'
import { lairTowerSpots } from '../world/lair-generator'

const CRYSTAL_HP = 20

/** One floating healing crystal atop an obsidian tower. */
export class CrystalTower implements Hittable {
  readonly position: THREE.Vector3
  readonly hitRadius = 1.3
  alive = true
  private hp = CRYSTAL_HP
  private readonly mesh: THREE.Mesh
  private readonly coreMaterial: THREE.MeshBasicMaterial
  private readonly baseColor: THREE.Color
  private readonly beam: THREE.Line
  private readonly beamPositions = new Float32Array(6)
  private spin = Math.random() * 10
  onDestroyed: (() => void) | null = null

  constructor(
    private readonly scene: THREE.Scene,
    private readonly effects: ParticleEffects,
    x: number,
    y: number,
    z: number,
  ) {
    this.position = new THREE.Vector3(x, y, z)
    // HDR-bright magenta so the crystal core and beam bloom at night.
    this.baseColor = new THREE.Color(0xe86af0).multiplyScalar(2.9)
    this.coreMaterial = new THREE.MeshBasicMaterial({ color: this.baseColor.clone() })
    this.mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.75), this.coreMaterial)
    this.mesh.position.copy(this.position)
    scene.add(this.mesh)

    const beamGeometry = new THREE.BufferGeometry()
    beamGeometry.setAttribute('position', new THREE.BufferAttribute(this.beamPositions, 3))
    this.beam = new THREE.Line(
      beamGeometry,
      new THREE.LineBasicMaterial({
        color: new THREE.Color(0xf07af8).multiplyScalar(2.9),
        transparent: true,
        opacity: 0.65,
      }),
    )
    this.beam.frustumCulled = false
    this.beam.visible = false
    scene.add(this.beam)
  }

  takeHit(amount: number, _dir: THREE.Vector3): void {
    if (!this.alive) return
    this.hp -= amount
    // Rapid hits must not capture the flash white as the restore color.
    this.coreMaterial.color.setRGB(3.2, 3.2, 3.2)
    setTimeout(() => this.coreMaterial.color.copy(this.baseColor), 90)
    if (this.hp <= 0) this.destroy()
  }

  private destroy(): void {
    this.alive = false
    this.effects.explosion(this.position.x, this.position.y, this.position.z, 1.2)
    this.scene.remove(this.mesh, this.beam)
    this.mesh.geometry.dispose()
    this.coreMaterial.dispose()
    this.beam.geometry.dispose()
    ;(this.beam.material as THREE.Material).dispose()
    this.onDestroyed?.()
  }

  /** Point the heal beam at the dragon, or hide it. */
  setBeamTarget(target: THREE.Vector3 | null): void {
    if (!this.alive || !target) {
      this.beam.visible = false
      return
    }
    this.beam.visible = true
    this.beamPositions[0] = this.position.x
    this.beamPositions[1] = this.position.y
    this.beamPositions[2] = this.position.z
    this.beamPositions[3] = target.x
    this.beamPositions[4] = target.y
    this.beamPositions[5] = target.z
    this.beam.geometry.getAttribute('position').needsUpdate = true
  }

  update(dt: number): void {
    if (!this.alive) return
    this.spin += dt
    this.mesh.rotation.y = this.spin * 1.4
    this.mesh.rotation.x = Math.sin(this.spin * 0.8) * 0.3
    this.mesh.position.y = this.position.y + Math.sin(this.spin * 2) * 0.15
  }
}

/** Spawns and tracks the four lair crystals. */
export class CrystalManager {
  readonly crystals: CrystalTower[] = []

  constructor(scene: THREE.Scene, effects: ParticleEffects) {
    for (const spot of lairTowerSpots()) {
      this.crystals.push(
        new CrystalTower(scene, effects, spot.x + 1, spot.topY + 1.6, spot.z + 1),
      )
    }
  }

  get aliveCount(): number {
    return this.crystals.filter((c) => c.alive).length
  }

  update(dt: number, dragonPos: THREE.Vector3 | null): void {
    for (const crystal of this.crystals) {
      crystal.update(dt)
      crystal.setBeamTarget(dragonPos)
    }
  }
}
