import * as THREE from 'three'
import { lerp } from '../core/math-utils'
import { T, tileUV } from '../world/texture-atlas'

export type PickupKind = 'meat'

interface PickupItem {
  kind: PickupKind
  mesh: THREE.Mesh
  baseY: number
  age: number
}

const KIND_TILE: Readonly<Record<PickupKind, number>> = {
  meat: T.MEAT_ICON,
}

const MAX_AGE = 60
const COLLECT_RANGE = 1.7

/** Bobbing billboard item drops that auto-collect on approach. */
export class Pickups {
  private readonly items: PickupItem[] = []
  private readonly material: THREE.MeshBasicMaterial

  constructor(
    private readonly scene: THREE.Scene,
    map: THREE.Texture,
  ) {
    this.material = new THREE.MeshBasicMaterial({
      map,
      alphaTest: 0.1,
      side: THREE.DoubleSide,
    })
  }

  spawn(kind: PickupKind, x: number, y: number, z: number): void {
    const geometry = new THREE.PlaneGeometry(0.55, 0.55)
    const [u0, v0, u1, v1] = tileUV(KIND_TILE[kind])
    const uv = geometry.getAttribute('uv') as THREE.BufferAttribute
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, lerp(u0, u1, uv.getX(i)), lerp(v0, v1, uv.getY(i)))
    }
    const mesh = new THREE.Mesh(geometry, this.material)
    mesh.position.set(x, y + 0.4, z)
    this.scene.add(mesh)
    this.items.push({ kind, mesh, baseY: y + 0.4, age: 0 })
  }

  update(dt: number, playerPos: THREE.Vector3, onCollect: (kind: PickupKind) => void): void {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i] as PickupItem
      item.age += dt
      item.mesh.position.y = item.baseY + Math.sin(item.age * 3) * 0.12
      item.mesh.rotation.y += dt * 2
      const d = item.mesh.position.distanceTo(playerPos)
      if (d < COLLECT_RANGE || item.age > MAX_AGE) {
        if (d < COLLECT_RANGE) onCollect(item.kind)
        this.scene.remove(item.mesh)
        item.mesh.geometry.dispose()
        this.items.splice(i, 1)
      }
    }
  }
}
