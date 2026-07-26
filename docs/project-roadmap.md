# Project Roadmap

## Shipped

### 0.1.0 — The game (2026-07-26)

Infinite streaming voxel world (4 biomes), mining/building, 6 creature types, combat and survival systems, the fire-breathing dragon boss with crystal towers, the full quest chain, day/night cycle, procedural textures + synthesized audio, Docker packaging.

### 0.2.0 — Beauty & feel (2026-07-26)

ACES + HDR bloom pipeline, shader sky dome with clouds and star twinkle, wind-swayed foliage and rippling water, camera shake / sprint FOV / break cracks, per-surface footsteps and nature ambience, fireflies/leaves/bubbles, live title panorama, HUD polish, block-edit persistence across reloads, 52-test unit suite, oxlint gate, full repo bootstrap (CI, ADRs, docs).

## Candidate next steps (unscheduled ideas, not commitments)

Gameplay:

- Crafting: turn logs into planks, cobble into tools, tiered mining speeds
- More structures: villages, caves with ore veins, ruins with loot
- More creatures: wolves (tameable), bats in caves, fish in lakes
- Save slots / multiple named worlds (extend the edit-diff store with a world registry)

Presentation:

- Biome-specific ambient music beds (synthesized pads, day/night variants)
- Weather: rain with surface splash particles, snowfall in the snow biome
- Settings screen: render distance, FOV, sensitivity, volume sliders

Platform:

- Mobile touch controls (virtual joystick + tap-to-mine)
- Gamepad support via the Gamepad API
- GitHub Pages deploy of `dist/` as a playable demo link

Engineering:

- Web-worker chunk generation if per-chunk features grow heavier (see ADR-0004)
- Swap oxlint → typescript-eslint when it supports TS 7 (see ADR-0003)
- Lighthouse/perf budget check in CI

## Non-goals

- Multiplayer (an entirely different engine architecture)
- Server-side anything — the zero-backend property is a feature (see SECURITY.md)
