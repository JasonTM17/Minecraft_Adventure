# Codebase Summary

~5 900 lines of strict TypeScript across 44 modules. Entry point: `src/main.ts` (composition root — builds every system and wires the frame loop). Full module map with responsibilities: [system-architecture.md](system-architecture.md).

| Directory | Files | Lines | Purpose |
|---|---|---|---|
| `src/core` | 4 | 270 | Renderer + post pipeline (`game.ts`), state machine, input, math/PRNG utils |
| `src/world` | 11 | 1529 | Noise, chunks, terrain/lair generation, mesher, streaming, edit persistence, texture atlas |
| `src/player` | 5 | 713 | Controller, voxel physics, block interaction (mining/placing/cracks), inventory, held-item view |
| `src/entities` | 9 | 1419 | Mob framework, animals, monsters, spawner, pickups, dragon model + AI, crystal towers |
| `src/combat` | 3 | 395 | Projectiles (arrows/fireballs), melee/bow/food system, lingering fire zones |
| `src/effects` | 6 | 833 | Sky + sky dome, wind shader injection, camera shake, ambient life, particle pools |
| `src/adventure` | 1 | 105 | Quest chain state machine |
| `src/ui` | 3 | 299 | DOM HUD, full-screen overlays, menu panorama camera |
| `src/audio` | 1 | 199 | Fully synthesized WebAudio SFX |
| `tests` | 5 | — | Vitest unit suites: noise, math-utils, block-edit-store, quest-manager, voxel-physics |

## Reading order for newcomers

1. `src/main.ts` — how everything connects (callbacks, no global event bus).
2. `src/world/world.ts` + `src/world/chunk-mesher.ts` — the voxel heart: streaming, meshing, AO.
3. `src/player/player-controller.ts` + `src/player/voxel-physics.ts` — movement shared by player and mobs.
4. `src/entities/dragon-boss.ts` — the most complex state machine in the game.
5. `src/core/game.ts` — frame loop, pause semantics (`timeScale`), post pipeline.

## Key cross-cutting facts

- Systems communicate through constructor injection and explicit callbacks assigned in `main.ts`; there is no service locator or event bus.
- `game.onUpdate` receives pause-scaled time; `game.onAlwaysUpdate` receives raw time (sky, HUD, chunk streaming keep running behind menus).
- The voxel grid is authoritative for physics/raycasts; all shader motion (wind, waves) is visual-only displacement.
- Dev-only debug handles live behind `import.meta.env.DEV` as `window.__debug`.
