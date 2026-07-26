# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-07-26

### Added

- Filmic render pipeline: ACES tone mapping with an HDR bloom pass (sun, flames, explosions, fireball cores and crystal beams glow; terrain never hazes).
- Shader sky dome with sunrise/sunset glow, drifting procedural clouds and individually twinkling stars.
- Wind motion: swaying grass, flowers and leaves; rippling water (vertex-shader only, no extra draw calls).
- Game feel: trauma-based camera shake, sprint FOV kick, progressive block-break crack overlay.
- Audio: per-surface footsteps (grass/sand/stone/wood/snow), skeleton bow shots and distance-scaled arrow impacts, crickets, birdsong and wind ambience.
- Ambient life: fireflies at night, falling leaves in forests, bubbles underwater.
- Live world panorama behind the title and victory screens; HUD polish (low-HP heartbeat, boss-bar shine, quest banner animation).
- Block-edit persistence: mined/placed blocks survive chunk unloading and full page reloads (per-seed localStorage).
- Unit test suite (Vitest, 52 tests) and lint gate (oxlint, warnings are errors).

### Fixed

- Simulation no longer runs behind the title menu (idle players could previously be attacked unseen).
- Menu panorama camera keeps clearance over hills instead of clipping into terrain.
- Bloom threshold raised above noon snowfield brightness to remove daytime haze.

## [0.1.0] - 2026-07-26

### Added

- Infinite procedurally generated voxel world streamed in 16×96×16 chunks: plains, forest, desert and snow biomes, trees, lakes, flowers.
- Mining and building with a 9-slot hotbar, DDA raycast targeting and per-block break times.
- Creatures: pigs, cows, sheep, chickens (wander/flee/drops); zombies and skeletons at night that burn at dawn.
- Combat and survival: sword melee, chargeable bow, hearts, fall damage, food healing, passive regen.
- Fire-breathing dragon boss with an articulated rig, swoop/fireball/flame-breath attacks and four healing crystal towers in an obsidian lair.
- Adventure quest chain: hunt → find the lair (compass) → destroy the crystals → slay the dragon.
- Day/night cycle, procedural texture atlas, fully synthesized sound — zero external assets.
- Docker packaging (multi-stage build, unprivileged nginx, healthcheck).
