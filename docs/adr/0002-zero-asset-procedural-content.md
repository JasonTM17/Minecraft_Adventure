# 2. Zero-asset procedural content

Date: 2026-07-26

## Status

Accepted

## Context

A voxel game needs block textures, creature skins, UI icons and sound effects. Shipping asset files means licensing questions, download weight, loading states and an asset pipeline.

## Decision

Every texture is painted onto a single 256×256 canvas atlas at startup (seeded RNG, 16 px tiles, nearest-neighbor filtering) and every sound is synthesized live with WebAudio oscillators and filtered noise. The game ships zero binary assets; the only runtime dependency is `three`.

## Consequences

### Positive

- No licensing risk, no CDN, no loading screens; the bundle is a few hundred KB.
- Deterministic look from a seed; icons are CSS-sliced from the same atlas data URL.

### Negative

- Art direction is bounded by what procedural pixel drawing can express.
- Audio has a distinct chiptune character; real recordings are out of reach.

### Neutral

- All visual identity lives in code (`texture-atlas.ts`, `sfx.ts`) and is reviewed like code.

## Alternatives considered

- Public-domain texture/sound packs — adds attribution management and asset loading for marginal visual gain at this scope.
- Hand-drawn sprite sheets — requires an artist workflow the project does not have.

## References

- `src/world/texture-atlas.ts`, `src/audio/sfx.ts`
