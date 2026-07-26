import type * as THREE from 'three'
import type { GameStateMachine } from '../core/game-state'
import type { PlayerController } from '../player/player-controller'
import type { World } from '../world/world'

const ORBIT_RADIUS = 26
const ORBIT_HEIGHT = 19
const ORBIT_SPEED = 0.055
const GROUND_CLEARANCE = 5

/**
 * Slow aerial orbit around the player shown behind the title and victory
 * screens. The player controller rewrites the full camera transform every
 * playing frame, so handing the camera back is seamless.
 */
export class MenuPanorama {
  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly player: PlayerController,
    private readonly state: GameStateMachine,
    private readonly world: World,
  ) {}

  update(elapsed: number): void {
    if (this.state.state !== 'menu' && this.state.state !== 'victory') return
    const c = this.player.position
    const a = elapsed * ORBIT_SPEED
    const x = c.x + Math.cos(a) * ORBIT_RADIUS
    const z = c.z + Math.sin(a) * ORBIT_RADIUS
    // Hills (or the lair wall on the victory screen) must not swallow the
    // camera — ride above whatever terrain the orbit passes over.
    const ground = this.world.surfaceY(x, z)
    const y = Math.max(c.y + ORBIT_HEIGHT, ground + GROUND_CLEARANCE)
    this.camera.position.set(x, y, z)
    this.camera.lookAt(c.x, c.y + 2, c.z)
  }
}
