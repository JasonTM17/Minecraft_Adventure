import * as THREE from 'three'
import './style.css'
import { QuestManager } from './adventure/quest-manager'
import { Sfx } from './audio/sfx'
import { CombatSystem } from './combat/combat-system'
import { FireZones } from './combat/fire-zones'
import { Projectiles } from './combat/projectiles'
import { Game } from './core/game'
import { GameStateMachine } from './core/game-state'
import { InputManager } from './core/input-manager'
import { AmbientLife } from './effects/ambient-life'
import { CameraFx } from './effects/camera-effects'
import { ParticleEffects } from './effects/particles'
import { Sky } from './effects/sky'
import { WIND } from './effects/wind-uniform'
import { CrystalManager } from './entities/crystal-towers'
import { DragonBoss } from './entities/dragon-boss'
import { MobSpawner } from './entities/mob-spawner'
import { PassiveMob } from './entities/passive-mobs'
import { Pickups } from './entities/pickups'
import type { MobContext } from './entities/mob'
import { BlockInteraction } from './player/block-interaction'
import { HeldItemView } from './player/held-item-view'
import { Inventory } from './player/inventory'
import { PlayerController } from './player/player-controller'
import { Hud } from './ui/hud'
import { MenuPanorama } from './ui/menu-panorama'
import { Screens } from './ui/screens'
import { BlockEditStore } from './world/block-edit-store'
import { Block } from './world/block-registry'
import { applyLairToChunk } from './world/lair-generator'
import { buildAtlas } from './world/texture-atlas'
import { TerrainGenerator } from './world/terrain-generator'
import { World } from './world/world'

const app = document.querySelector<HTMLDivElement>('#app')
const ui = document.querySelector<HTMLDivElement>('#ui')
if (!app || !ui) throw new Error('Missing #app/#ui mount points')

const WORLD_SEED = 20260726
const SPAWN_X = 8
const SPAWN_Z = 8

// --- Core systems -----------------------------------------------------------

const game = new Game(app)
game.scene.background = new THREE.Color(0x87b8e8)
game.scene.fog = new THREE.Fog(0x87b8e8, 60, 150)

const atlas = buildAtlas()
const terrain = new TerrainGenerator(WORLD_SEED)
const editStore = new BlockEditStore(`mcadv-edits-${WORLD_SEED}`)
editStore.load()
const world = new World(game.scene, terrain, atlas, editStore)
world.onChunkGenerated = (chunk) => applyLairToChunk(chunk)
const sky = new Sky(game.scene)
const effects = new ParticleEffects(game.scene)
const ambientLife = new AmbientLife(world, terrain, sky, effects)
const sfx = new Sfx()

const input = new InputManager(game.renderer.domElement)
const inventory = new Inventory()
const player = new PlayerController(world, game.camera, input)
player.spawnAt(SPAWN_X, SPAWN_Z)
const interaction = new BlockInteraction(
  world,
  game.camera,
  input,
  player,
  inventory,
  game.scene,
  atlas.texture,
)
const cameraFx = new CameraFx(game.camera)
const pickups = new Pickups(game.scene, atlas.texture)
const spawner = new MobSpawner(game.scene, world, atlas.texture, pickups)
const projectiles = new Projectiles(game.scene, world, effects)
const combat = new CombatSystem(player, game.camera, input, inventory, projectiles, effects)
const heldItem = new HeldItemView(game.camera, inventory, atlas.texture)

const fireZones = new FireZones(world, effects)
const crystals = new CrystalManager(game.scene, effects)
const dragon = new DragonBoss(game.scene, atlas.texture, projectiles, fireZones, effects, crystals)
combat.hittables.push(dragon, ...crystals.crystals)
projectiles.onFireballExplode = (x, y, z) => {
  fireZones.igniteBurst(x, z, 4, 5)
  const dist = player.position.distanceTo(new THREE.Vector3(x, y, z))
  if (dist < 20) cameraFx.addShake(Math.max(0.15, 0.7 - dist * 0.03))
}

const mobContext: MobContext = {
  playerPosition: player.position,
  isNight: false,
  effects,
  damagePlayer: (amount, source) => player.damage(amount, source),
  shootArrow: (origin, dir) => {
    projectiles.spawnArrow(origin, dir, 'mob', 22)
    sfx.bowShoot()
  },
}

// --- Adventure flow, UI, audio ---------------------------------------------

const state = new GameStateMachine()
const quests = new QuestManager()
const hud = new Hud(ui, atlas.canvas, inventory)
const panorama = new MenuPanorama(game.camera, player, state)

const crosshair = document.createElement('div')
crosshair.className = 'crosshair'
ui.appendChild(crosshair)

const stats = { playTime: 0, kills: 0 }

const screens = new Screens(ui, {
  onPlay: () => {
    sfx.unlock()
    input.requestLock()
  },
  onResume: () => input.requestLock(),
  onRespawn: () => {
    player.spawnAt(SPAWN_X, SPAWN_Z)
    input.requestLock()
  },
  onPlayAgain: () => input.requestLock(),
})
screens.show('menu')

state.onChange = (next) => {
  game.timeScale = next === 'playing' ? 1 : 0
  screens.show(next === 'playing' ? null : next)
  // Unlocked fallback mode still needs clicks + mouse-look while playing.
  input.captureUnlocked = next === 'playing' && !input.locked
  // First-person widgets have no place over the aerial menu panorama.
  const inGame = next === 'playing' || next === 'paused' || next === 'dead'
  heldItem.setVisible(inGame)
  crosshair.style.display = next === 'playing' ? '' : 'none'
  ui.classList.toggle('hide-hud', !inGame)
}
// The session opens on the menu, which onChange never saw.
heldItem.setVisible(false)
crosshair.style.display = 'none'
ui.classList.add('hide-hud')

input.onLockChange = (locked) => {
  if (locked) {
    lockRetries = 0
    state.set('playing')
  } else if (state.state === 'playing') {
    state.set('paused')
  }
}

// Browsers can refuse pointer lock (embedded contexts, or Chrome's cooldown
// right after an exit). Enter unlocked play immediately so input keeps
// working, then retry the lock once per user action — environments where the
// lock never succeeds must not loop retries forever.
let lockRetries = 0
document.addEventListener('pointerlockerror', () => {
  if (state.state !== 'playing') state.set('playing')
  input.captureUnlocked = true
  if (lockRetries < 1) {
    lockRetries++
    window.setTimeout(() => {
      if (state.state === 'playing' && !input.locked) input.requestLock()
    }, 1600)
  }
})

player.onDamaged = () => {
  sfx.hurt()
  hud.flashDamage()
  cameraFx.addShake(0.45)
}
player.onHardLanding = (speed) => {
  cameraFx.addShake(Math.min(0.45, (speed - 9) * 0.045))
}
player.onFootstep = () => {
  const below = world.getBlock(
    Math.floor(player.position.x),
    Math.floor(player.position.y - 0.1),
    Math.floor(player.position.z),
  )
  if (below === Block.GRASS || below === Block.DIRT || below === Block.LEAVES) {
    sfx.footstep('grass')
  } else if (below === Block.SAND) sfx.footstep('sand')
  else if (below === Block.SNOW) sfx.footstep('snow')
  else if (below === Block.PLANKS || below === Block.LOG) sfx.footstep('wood')
  else sfx.footstep('stone')
}
projectiles.onArrowImpact = () => sfx.arrowHit()
player.onDied = (source) => {
  screens.setDeathCause(`Slain by ${source}`)
  sfx.death()
  state.set('dead')
  input.exitLock()
}

interaction.onBlockBroken = (x, y, z, id) => {
  effects.blockBreak(x, y, z, id)
  sfx.dig()
}
interaction.onBlockPlaced = () => sfx.place()

combat.events = {
  onMeleeHit: () => sfx.meleeHit(),
  onBowShot: () => sfx.bowShoot(),
  onEat: () => sfx.eat(),
}

spawner.onMobKilled = (mob) => {
  stats.kills++
  if (mob instanceof PassiveMob) quests.creatureKilled()
}

for (const crystal of crystals.crystals) {
  crystal.onDestroyed = () => {
    sfx.crystalBreak()
    sfx.explosion()
    quests.crystalDestroyed()
  }
}

dragon.events = {
  onRoar: () => {
    sfx.dragonRoar()
    cameraFx.addShake(0.3)
  },
  onFireball: () => sfx.fireball(),
  onBreathStart: () => sfx.flameBreath(),
  onDeath: () => {
    sfx.explosion()
    quests.dragonSlain()
  },
}

quests.onAdvance = () => sfx.questDone()
quests.onCompleted = () => {
  sfx.victory()
  const minutes = Math.floor(stats.playTime / 60)
  const seconds = Math.floor(stats.playTime % 60)
  screens.setVictoryStats(
    `Time: ${minutes}m ${seconds}s · Creatures slain: ${stats.kills}`,
  )
  window.setTimeout(() => {
    // The player may have died to lingering fire during the celebration delay.
    if (state.state === 'playing') {
      state.set('victory')
      input.exitLock()
    }
  }, 1800)
}

// --- Frame loop -------------------------------------------------------------

let ambientTimer = 4
let natureTimer = 7

game.onUpdate((dt) => {
  stats.playTime += dt

  player.update(dt)
  cameraFx.sprinting = player.sprinting
  cameraFx.update(dt)
  combat.update(dt, spawner.mobs)
  interaction.suppressed = combat.suppressBreaking > 0
  interaction.update(dt)
  effects.update(dt)
  ambientLife.update(dt, player.position, player.eyeInWater)

  mobContext.isNight = sky.isNight()
  spawner.update(dt, mobContext)
  pickups.update(dt, player.position, () => {
    inventory.addFood(1)
    sfx.pickup()
  })
  projectiles.update(dt, {
    player,
    mobs: spawner.mobs,
    hittables: combat.hittables,
    damagePlayer: mobContext.damagePlayer,
  })

  dragon.update(dt, player)
  crystals.update(dt, dragon.engaged ? dragon.position : null)
  fireZones.update(dt, player, mobContext.damagePlayer)
  quests.update(player.position)

  // Ambient creature voices nearby.
  ambientTimer -= dt
  if (ambientTimer <= 0) {
    ambientTimer = 2.5 + Math.random() * 3
    const nearby = spawner.mobs.filter(
      (m) => !m.dead && m.position.distanceTo(player.position) < 22,
    )
    const mob = nearby[Math.floor(Math.random() * nearby.length)]
    if (mob instanceof PassiveMob) sfx.mobCall(mob.species)
    else if (mob) sfx.zombieGroan()
  }

  // Quiet nature bed: crickets at night, birdsong by day, occasional wind.
  natureTimer -= dt
  if (natureTimer <= 0) {
    natureTimer = 6 + Math.random() * 8
    if (Math.random() < 0.18) sfx.wind()
    else if (sky.isNight()) sfx.cricket()
    else if (sky.lightLevel() > 0.6) sfx.bird()
  }

  for (let i = 1; i <= 9; i++) {
    if (input.wasPressed(`Digit${i}`)) inventory.select(i - 1)
  }
  const wheel = input.consumeWheel()
  if (wheel !== 0) inventory.scroll(wheel)
  if (input.wasPressed('KeyM')) sfx.toggleMute()
  // Esc pauses in unlocked fallback mode (with pointer lock the browser
  // exits the lock first and onLockChange handles the pause).
  if (input.wasPressed('Escape') && !input.locked) state.set('paused')

  heldItem.update(dt, player, combat, interaction)
  input.endFrame()
})

game.onAlwaysUpdate((dt) => {
  // Chunks stream even on the title/pause screens so the world is ready
  // behind the menu instead of popping in after the first click.
  world.update(player.position.x, player.position.z)
  WIND.value += dt
  panorama.update(game.elapsed)
  sky.update(dt, player.position, player.eyeInWater)
  hud.update(dt, player, dragon)
  hud.setQuestText(quests.bannerText(player.position), quests.showCompass())
})

// Flush pending block edits when the tab hides or closes.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') editStore.save()
})
window.addEventListener('beforeunload', () => editStore.save())

game.start()

// Dev-only console hooks for manual testing (stripped from production builds).
if (import.meta.env.DEV) {
  Object.assign(window as unknown as Record<string, unknown>, {
    __debug: {
      player,
      dragon,
      sky,
      quests,
      state,
      teleport: (x: number, z: number) => player.spawnAt(x, z),
    },
  })
}
