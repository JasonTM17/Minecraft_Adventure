# 5. Block-edit persistence as a per-chunk diff map

Date: 2026-07-26

## Status

Accepted

## Context

With regenerating chunks (ADR-0004), player mining and building vanished once a chunk left the unload radius — acceptable for a demo, wrong for an adventure game where players build. Any fix must not give up terrain determinism.

## Decision

Player edits are recorded as a diff over generated terrain: `chunkKey → (voxelIndex → blockId)`. Freshly generated chunks re-apply their diff after terrain and structure generation, so player edits always win. The diff serializes to localStorage per world seed (debounced 3 s, flushed on tab hide/close), entries are validated on load, and least-recently-touched chunks are evicted past 50 000 edits.

## Consequences

### Positive

- Builds survive unloading and full page reloads; storage cost scales with what the player changed, not where they went.
- Terrain generation stays pure; the diff is the only mutable world state.

### Negative

- Two tabs on the same seed are last-writer-wins (whole-store save). Accepted for a single-player session game.
- Redundant edits that restore the generated value are still stored (no diff-cancellation detection).

### Neutral

- The 50k cap (~1 MB serialized) sits far below localStorage quotas.

## Alternatives considered

- Serializing whole modified chunks — 24 KB per chunk regardless of how little changed.
- IndexedDB — async API and schema for no benefit at this data size.
- No persistence — the shipped 0.1.0 behavior this ADR replaces.

## References

- `src/world/block-edit-store.ts`, `src/world/world.ts`, ADR-0004
