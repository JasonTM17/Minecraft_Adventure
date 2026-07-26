import * as THREE from 'three'
import './style.css'
import { Game } from './core/game'
import { InputManager } from './core/input-manager'
import { clamp } from './core/math-utils'
import { buildAtlas } from './world/texture-atlas'
import { TerrainGenerator } from './world/terrain-generator'
import { World } from './world/world'

// Temporary fly-camera preview over the streaming terrain.
// The full player controller replaces this bootstrap next.
const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('Missing #app mount point')

const WORLD_SEED = 20260726

const game = new Game(app)
game.scene.background = new THREE.Color(0x87b8e8)
game.scene.fog = new THREE.Fog(0x87b8e8, 60, 150)

const atlas = buildAtlas()
const terrain = new TerrainGenerator(WORLD_SEED)
const world = new World(game.scene, terrain, atlas)

const sun = new THREE.DirectionalLight(0xffffff, 2.0)
sun.position.set(0.6, 1, 0.35)
game.scene.add(sun, new THREE.AmbientLight(0xb8c8e8, 1.4))

const input = new InputManager(game.renderer.domElement)
game.renderer.domElement.addEventListener('click', () => input.requestLock())

let yaw = 0
let pitch = -0.4
game.camera.position.set(8, terrain.heightAt(8, 8) + 24, 8)

game.onUpdate((dt) => {
  const [mx, my] = input.consumeMouseDelta()
  yaw -= mx * 0.0022
  pitch = clamp(pitch - my * 0.0022, -1.55, 1.55)
  game.camera.rotation.set(pitch, yaw, 0, 'YXZ')

  const speed = input.isDown('ShiftLeft') ? 60 : 24
  const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw))
  const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw))
  const move = new THREE.Vector3()
  if (input.isDown('KeyW')) move.add(forward)
  if (input.isDown('KeyS')) move.sub(forward)
  if (input.isDown('KeyD')) move.add(right)
  if (input.isDown('KeyA')) move.sub(right)
  if (input.isDown('Space')) move.y += 1
  if (input.isDown('ControlLeft')) move.y -= 1
  if (move.lengthSq() > 0) {
    move.normalize().multiplyScalar(speed * dt)
    game.camera.position.add(move)
  }

  world.update(game.camera.position.x, game.camera.position.z)
  input.endFrame()
})

game.start()
