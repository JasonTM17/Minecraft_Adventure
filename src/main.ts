import * as THREE from 'three'
import './style.css'
import { Game } from './core/game'
import { InputManager } from './core/input-manager'
import { ParticleEffects } from './effects/particles'
import { Sky } from './effects/sky'
import { BlockInteraction } from './player/block-interaction'
import { Inventory } from './player/inventory'
import { PlayerController } from './player/player-controller'
import { buildAtlas } from './world/texture-atlas'
import { TerrainGenerator } from './world/terrain-generator'
import { World } from './world/world'

const app = document.querySelector<HTMLDivElement>('#app')
const ui = document.querySelector<HTMLDivElement>('#ui')
if (!app || !ui) throw new Error('Missing #app/#ui mount points')

const WORLD_SEED = 20260726

const game = new Game(app)
game.scene.background = new THREE.Color(0x87b8e8)
game.scene.fog = new THREE.Fog(0x87b8e8, 60, 150)

const atlas = buildAtlas()
const terrain = new TerrainGenerator(WORLD_SEED)
const world = new World(game.scene, terrain, atlas)
const sky = new Sky(game.scene)
const effects = new ParticleEffects(game.scene)

const input = new InputManager(game.renderer.domElement)
game.renderer.domElement.addEventListener('click', () => input.requestLock())

const inventory = new Inventory()
const player = new PlayerController(world, game.camera, input)
player.spawnAt(8, 8)
const interaction = new BlockInteraction(world, game.camera, input, player, inventory, game.scene)
interaction.onBlockBroken = (x, y, z, id) => effects.blockBreak(x, y, z, id)

const crosshair = document.createElement('div')
crosshair.className = 'crosshair'
ui.appendChild(crosshair)

game.onUpdate((dt) => {
  player.update(dt)
  interaction.update(dt)
  effects.update(dt)

  for (let i = 1; i <= 9; i++) {
    if (input.wasPressed(`Digit${i}`)) inventory.select(i - 1)
  }
  const wheel = input.consumeWheel()
  if (wheel !== 0) inventory.scroll(wheel)

  world.update(player.position.x, player.position.z)
  input.endFrame()
})

game.onAlwaysUpdate((dt) => {
  sky.update(dt, player.position, player.eyeInWater)
})

game.start()
