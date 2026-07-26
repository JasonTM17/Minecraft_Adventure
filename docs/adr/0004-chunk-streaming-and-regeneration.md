# 4. Deterministic chunk streaming with regeneration

Date: 2026-07-26

## Status

Accepted

## Context

An "infinite" world cannot keep every visited chunk in memory. The engine needs a policy for loading, unloading and what happens at the edge of generated space — on the main thread, within a 60 fps budget.

## Decision

Terrain is a pure function of `(seed, x, z)`. Chunks (16×96×16 `Uint8Array`) generate in a ring around the player on a per-frame budget (3 generated, 2 meshed), unload beyond radius 8, and simply regenerate on return. Reads from ungenerated space return stone, so border faces stay hidden and physics can never fall out of the world. Structures (the dragon lair) post-process chunk data through an `onChunkGenerated` hook rather than owning their own storage.

## Consequences

### Positive

- Memory is bounded by view distance regardless of distance travelled.
- No save format, no async chunk workers, no seam artifacts at generation borders.
- Fast travel is hitch-free because per-frame work is capped, not per-chunk.

### Negative

- Anything not derivable from the seed is lost on unload — which forced ADR-0005 for player edits.
- Main-thread generation caps how expensive per-chunk features can be.

### Neutral

- Diagonal neighbors are re-meshed on generation because corner ambient occlusion samples across chunk corners.

## Alternatives considered

- Persisting every generated chunk — orders of magnitude more storage for data that is reproducible by definition.
- Web-worker generation — better ceilings, but complexity (transfer, ordering) not needed at the current budget.

## References

- `src/world/world.ts`, `src/world/terrain-generator.ts`, ADR-0005
