# Code Standards

The conventions actually used in this codebase. CI enforces the mechanical ones.

## Language & compiler

- TypeScript strict mode; the build gate is `tsc --noEmit && vite build` (TS 7 native preview — see [ADR-0003](adr/0003-typescript-7-native-preview.md)).
- No `any` (implicit or explicit). Narrow with types, not assertions, except at well-commented DOM/three boundaries.
- Runtime dependencies: `three` only. Adding another runtime dep is an architecture decision (write an ADR).

## Files & structure

- Kebab-case file names, long and descriptive: `block-edit-store.ts`, not `store.ts`.
- One system per module/class; consider splitting past ~200 lines when a real boundary exists.
- Directory = subsystem (`world/`, `entities/`, `effects/`…). New modules go where their consumers already look.

## Wiring & state

- Systems receive dependencies via constructor parameters; cross-system events are explicit callback fields (`onBlockBroken`, `onMobKilled`) assigned in `main.ts`. No singletons, no event bus.
- Gameplay updates take `dt` from `game.onUpdate` (pause-scaled); ambient/UI updates use `game.onAlwaysUpdate` (raw dt).
- The voxel grid is the single source of truth for physics and raycasts; shaders may displace vertices visually but never gameplay state.

## Comments & docs

- JSDoc on public classes, methods and exported functions — one line stating the contract, not the implementation.
- Inline comments only for non-obvious constraints ("why", never "what").
- Architecture decisions go to `docs/adr/`; user-visible changes to `CHANGELOG.md`.

## GPU & performance discipline

- Dispose geometries/materials you create when their owner dies (see `disposeMeshes`, `Projectiles.remove`).
- No allocations in per-frame hot paths; reuse vectors/buffers (see particle pools).
- New bright visuals must respect the bloom contract in [ADR-0006](adr/0006-hdr-bloom-threshold-contract.md).

## Testing & gates

- Unit tests in `tests/`, mirroring `src/` layout, named `*.test.ts`; test real behavior, stub only the environment (localStorage, timers).
- All four gates green before merge: `npx tsc --noEmit`, `npm test`, `npm run lint`, `npm run build`.

## Commits

- Conventional Commits (`feat(scope):`, `fix:`, `docs:`, `test:`, `build:`, `ci:`, `chore:`), imperative, ≤ 72-char subject.
- One logical change per commit; commit clusters per feature phase.
