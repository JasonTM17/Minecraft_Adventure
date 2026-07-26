import * as THREE from 'three'
import './style.css'
import { CombatSystem } from './combat/combat-system'
import { Projectiles } from './combat/projectiles'
import { Game } from './core/game'
import { InputManager } from './core/input-manager'
import { ParticleEffects } from './effects/particles'
import { Sky } from './effects/sky'
import { MobSpawner } from './entities/mob-spawner'
import { Pickups } from './entities/pickups'
import type { MobContext } from './entities/mob'
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

const pickups = new Pickups(game.scene, atlas.texture)
const spawner = new MobSpawner(game.scene, world, atlas.texture, pickups)
const projectiles = new Projectiles(game.scene, world, effects)
const combat = new CombatSystem(player, game.camera, input, inventory, projectiles, effects)
const mobContext: MobContext = {
  playerPosition: player.position,
  isNight: false,
  effects,
  damagePlayer: (amount, source) => player.damage(amount, source),
  shootArrow: (origin, dir) => projectiles.spawnArrow(origin, dir, 'mob', 22),
}

const crosshair = document.createElement('div')
crosshair.className = 'crosshair'
ui.appendChild(crosshair)

game.onUpdate((dt) => {
  player.update(dt)
  combat.update(dt, spawner.mobs)
  interaction.suppressed = combat.suppressBreaking > 0
  interaction.update(dt)
  effects.update(dt)

  mobContext.isNight = sky.isNight()
  spawner.update(dt, mobContext)
  pickups.update(dt, player.position, () => inventory.addFood(1))
  projectiles.update(dt, {
    player,
    mobs: spawner.mobs,
    hittables: combat.hittables,
    damagePlayer: mobContext.damagePlayer,
  })

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
