import * as THREE from 'three'
import type { CombatSystem } from '../combat/combat-system'
import { tiledBox } from '../entities/mob-models'
import { lerp } from '../core/math-utils'
import { blockDef } from '../world/block-registry'
import { tileUV } from '../world/texture-atlas'
import type { BlockInteraction } from './block-interaction'
import type { Inventory } from './inventory'
import type { PlayerController } from './player-controller'

const BASE_POS = new THREE.Vector3(0.42, -0.42, -0.72)

/** First-person held item: atlas sprite for tools, mini cube for blocks. */
export class HeldItemView {
  private readonly group = new THREE.Group()
  private readonly spriteMaterial: THREE.MeshBasicMaterial
  private current: THREE.Object3D | null = null
  private lastKey = ''
  private bobPhase = 0
  private breakSwingPhase = 0

  constructor(
    camera: THREE.PerspectiveCamera,
    private readonly inventory: Inventory,
    map: THREE.Texture,
  ) {
    camera.add(this.group)
    this.group.position.copy(BASE_POS)
    this.spriteMaterial = new THREE.MeshBasicMaterial({
      map,
      alphaTest: 0.1,
      side: THREE.DoubleSide,
    })
  }

  private buildSprite(tile: number): THREE.Mesh {
    const geometry = new THREE.PlaneGeometry(0.5, 0.5)
    const [u0, v0, u1, v1] = tileUV(tile)
    const uv = geometry.getAttribute('uv') as THREE.BufferAttribute
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, lerp(u0, u1, uv.getX(i)), lerp(v0, v1, uv.getY(i)))
    }
    const mesh = new THREE.Mesh(geometry, this.spriteMaterial)
    mesh.rotation.y = -0.5
    return mesh
  }

  private buildBlockCube(blockId: number): THREE.Mesh | null {
    const faces = blockDef(blockId).faces
    if (!faces) return null
    const geometry = tiledBox(0.34, 0.34, 0.34, {
      px: faces.side,
      nx: faces.side,
      py: faces.top,
      ny: faces.bottom,
      pz: faces.side,
      nz: faces.side,
    })
    const material = new THREE.MeshLambertMaterial({ map: this.spriteMaterial.map })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.rotation.y = 0.6
    return mesh
  }

  private refreshMesh(): void {
    const slot = this.inventory.selectedSlot
    const key = `${this.inventory.selected}:${slot.count === 0 ? 'empty' : 'full'}`
    if (key === this.lastKey) return
    this.lastKey = key

    if (this.current) this.group.remove(this.current)
    this.current = null
    if (slot.kind === 'block' && (slot.count ?? 0) <= 0) return

    this.current =
      slot.kind === 'block' && slot.blockId !== undefined
        ? this.buildBlockCube(slot.blockId)
        : this.buildSprite(slot.icon)
    if (this.current) this.group.add(this.current)
  }

  update(
    dt: number,
    player: PlayerController,
    combat: CombatSystem,
    interaction: BlockInteraction,
  ): void {
    this.refreshMesh()

    const speed = Math.hypot(player.velocity.x, player.velocity.z)
    this.bobPhase += dt * (2 + speed * 1.6)
    const bob = Math.sin(this.bobPhase) * Math.min(0.03, speed * 0.01)

    let swingRot = 0
    let pull = 0
    if (combat.swingTime > 0) {
      const progress = 1 - combat.swingTime / 0.28
      swingRot = -Math.sin(progress * Math.PI) * 1.1
    } else if (interaction.isBreaking) {
      this.breakSwingPhase += dt * 11
      swingRot = -Math.abs(Math.sin(this.breakSwingPhase)) * 0.8
    } else {
      this.breakSwingPhase = 0
    }
    if (combat.bowCharge >= 0) pull = combat.bowCharge * 0.16

    this.group.position.set(BASE_POS.x - pull * 0.4, BASE_POS.y + bob, BASE_POS.z + pull)
    this.group.rotation.x = swingRot
  }
}
