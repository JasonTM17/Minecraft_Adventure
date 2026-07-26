import type * as THREE from 'three'
import type { GameStateMachine } from '../core/game-state'
import type { PlayerController } from '../player/player-controller'

const ORBIT_RADIUS = 26
const ORBIT_HEIGHT = 19
const ORBIT_SPEED = 0.055

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
  ) {}

  update(elapsed: number): void {
    if (this.state.state !== 'menu' && this.state.state !== 'victory') return
    const c = this.player.position
    const a = elapsed * ORBIT_SPEED
    this.camera.position.set(
      c.x + Math.cos(a) * ORBIT_RADIUS,
      c.y + ORBIT_HEIGHT,
      c.z + Math.sin(a) * ORBIT_RADIUS,
    )
    this.camera.lookAt(c.x, c.y + 2, c.z)
  }
}
