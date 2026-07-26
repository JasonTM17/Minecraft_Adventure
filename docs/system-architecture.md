# System Architecture

Single-page browser game. No backend — all state lives in the running page. Vite bundles TypeScript into one static site served by any web server (nginx in Docker).

## Module Map

```
main.ts ─────────────── composition root: builds every system, owns the frame loop wiring
│
├── core/
│   ├── game.ts               renderer + composer (ACES tone mapping, bloom, output pass),
│   │                         scene + camera + rAF loop, dt clamp, timeScale pause
│   ├── game-state.ts         MENU / PLAYING / PAUSED / DEAD / VICTORY transitions
│   ├── input-manager.ts      keyboard/mouse/pointer-lock state with per-frame edge events
│   └── math-utils.ts         clamp/lerp, mulberry32 PRNG, avalanche hash2i
│
├── world/
│   ├── noise.ts              seeded 2D value noise + fBm
│   ├── chunk.ts              16×96×16 Uint8Array voxel column
│   ├── terrain-generator.ts  heightmap, biomes, layering, water, cell-spaced trees, decorations
│   ├── lair-generator.ts     obsidian arena override, rim wall, perch, crystal towers
│   ├── chunk-mesher.ts       face culling, per-face brightness, 3-sample vertex AO,
│   │                         separate opaque/cutout/water geometries, cross-quad plants
│   ├── world.ts              chunk streaming (gen budget 3, mesh budget 2 per frame),
│   │                         cross-chunk getBlock/setBlock, unload + dispose
│   ├── block-edit-store.ts   player-edit diff map re-applied after chunk regen,
│   │                         debounced localStorage persistence keyed by seed
│   ├── texture-atlas.ts      256×256 canvas atlas painted at startup (terrain, deco,
│   │                         icons, break-crack stages)
│   ├── mob-skin-tiles.ts     creature skin + face tiles
│   └── texture-tile-helpers.ts  pixel/noise/pattern draw primitives
│
├── player/
│   ├── voxel-physics.ts      axis-separated AABB sweep vs voxels, substepping (shared w/ mobs)
│   ├── player-controller.ts  look, walk/sprint/jump/swim, fall damage, hp/regen/invuln
│   ├── block-interaction.ts  Amanatides–Woo DDA raycast, hold-to-break, placement rules
│   ├── inventory.ts          9-slot hotbar: sword/bow/food + counted block stacks
│   └── held-item-view.ts     camera-attached viewmodel with bob/swing/charge animation
│
├── entities/
│   ├── mob.ts                base: physics, health, knockback, hurt flash, limb swing
│   ├── mob-models.ts         atlas-UV box rigs: quadruped + humanoid builders
│   ├── passive-mobs.ts       pig/cow/sheep/chicken — idle/wander/flee state machine
│   ├── hostile-mobs.ts       zombie (chase+melee), skeleton (kite+arrows), dawn burning
│   ├── mob-spawner.ts        day/night population control, drops, despawn
│   ├── pickups.ts            bobbing billboard drops with magnet collect
│   ├── dragon-model.ts       hierarchical rig: body, 3-seg neck, jaw, 2-seg wings, 5-seg tail
│   ├── dragon-boss.ts        state machine: perched → takeoff → circling →
│   │                         swoop / fireball / flamebreath → dying → dead;
│   │                         crystal healing + damage reduction, banking steering
│   └── crystal-towers.ts     Hittable crystals with heal beams and explosion on death
│
├── combat/
│   ├── projectiles.ts        pooled arrows (gravity arc) + fireballs (explode, splash)
│   ├── combat-system.ts      sword cone melee, bow charge/release, eating
│   └── fire-zones.ts         lingering ground fire with burn damage
│
├── effects/
│   ├── sky.ts                keyframed day/night colors, sun/moon, fog, underwater override
│   ├── sky-dome.ts           gradient dome shader w/ sun glow, drifting procedural clouds,
│   │                         per-star twinkle shader
│   ├── wind-uniform.ts       shared wind clock injected into cutout/water vertex shaders
│   ├── camera-effects.ts     trauma-based camera shake + sprint FOV kick
│   ├── ambient-life.ts       firefly / falling-leaf / bubble spawn timers
│   └── particles.ts          2×1024 ring-buffer pools (normal + additive), shader points
│
├── adventure/quest-manager.ts   hunt → travel (compass) → crystals → dragon → victory
├── ui/hud.ts                    hearts, hotbar (atlas-sliced icons), boss bar, banner, vignette
├── ui/screens.ts                title / pause / death / victory overlays
├── ui/menu-panorama.ts          aerial orbit camera behind menu/victory screens
└── audio/sfx.ts                 all-synthesized WebAudio effects (tones + filtered noise)
```

## Data Flow

1. **Frame loop** (`game.ts`) calls gameplay updates with `dt × timeScale`; sky + HUD update even while paused.
2. **World streaming**: each frame `world.update(playerX, playerZ)` generates missing chunk data (budget 3) in a ring of radius 7, remeshes dirty chunks (budget 2) whose four neighbors have data, and unloads beyond radius 8. `lair-generator` post-processes any chunk intersecting the lair circle via the `onChunkGenerated` hook.
3. **Determinism + edits**: terrain is a pure function of `(seed, x, z)` — chunk data regenerates identically after unload. Player edits are recorded as a per-chunk diff (`block-edit-store.ts`) re-applied after regeneration, and serialized to localStorage (debounced 3 s, flushed on tab hide/close) so builds survive page reloads. The store evicts least-recently-touched chunks past 50k edits, validates every entry on load, and is last-writer-wins across tabs (two tabs on one seed overwrite each other — accepted for a single-player session game).
4. **Physics**: player and all mobs share `moveBody` (axis-separated sweeps with substepping). Ungenerated chunks read as stone so nothing falls through the world edge.
5. **Combat routing**: melee/arrows hit `Mob` AABBs and `Hittable` spheres (dragon, crystals); hostile projectiles and fire zones call `damagePlayer`, which applies the 0.5 s invulnerability window.
6. **Events**: block break/place, mob death, crystal destruction and dragon state changes fan out to particles, SFX and the quest manager; the quest chain drives the HUD banner and the victory screen.

## Rendering Notes

- Post pipeline: `RenderPass → UnrealBloomPass → OutputPass` on an HDR (half-float) composer. ACES filmic tone mapping; bloom threshold 2.6 sits above even noon snowfields (the brightest lit terrain, ≈2.5 linear) so only HDR-bright sources glow — sun/moon discs, flames, explosions, fireball cores, crystal cores/beams all carry colors multiplied well past the threshold on purpose.
- One material per pass: opaque, alpha-test cutout (leaves/plants, double-sided), transparent water (no depth write). All three sample the same canvas atlas with nearest filtering.
- Wind motion is vertex-shader-only (`onBeforeCompile` on the cutout/water materials, shared `uWind` clock): foliage sways in x/z, water ripples in y. Physics and raycasts keep using the undisplaced grid.
- The sky is a back-side dome shader (zenith→horizon gradient + sun glow) that ignores fog; the horizon color doubles as the fog color so distant terrain blends seamlessly. Clouds are one thresholded-noise plane at y=84 whose texture offset keeps the pattern world-anchored while drifting.
- Mesher emits chunk-local positions; meshes are placed at chunk origin so float precision stays healthy far from spawn.
- Particles are two `THREE.Points` draws total; the pool never allocates during play.
- Shadows are faked: per-face brightness plus 3-sample vertex ambient occlusion darkening corners.

## Performance Budget

- View distance 6 chunks (~169 loaded, ~113 rendered) at 96 world height.
- Chunk mesh rebuild ≤ 2/frame; generation ≤ 3/frame — moving fast streams terrain without hitches.
- Mob cap: 22 passive + 12 hostile; distant mobs despawn at 80 m.
- Fire zones capped at 24; particle pools fixed at 1024 per blend mode.
