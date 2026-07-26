# 6. HDR bloom threshold contract

Date: 2026-07-27

## Status

Accepted

## Context

The post pipeline (ACES tone mapping + UnrealBloomPass on a half-float composer) must make fire, the sun and crystals glow without hazing bright terrain. The first threshold (1.45) sat below the linear radiance of a noon snowfield (snow albedo ≈ 0.9 under ambient 1.4 + sun 2.0 ≈ 2.5), so daytime snow bloomed into fog.

## Decision

Bloom selection is a numeric contract, not a per-object flag:

- The threshold (2.6) sits strictly above the brightest possible lit terrain (~2.5 linear).
- Anything meant to glow opts in by carrying an HDR base color — `color.multiplyScalar(k)` with k chosen so the result clears 2.6 (sun ×3.4, moon ×2.8, crystal core/beam ×2.9, fireball core ×3.2). Additive particle stacking (flames, explosions) clears it by accumulation.

Changing scene lighting means re-deriving the terrain maximum and re-checking the contract.

## Consequences

### Positive

- No selective-bloom render layers or material flags; one full-scene pass stays cheap.
- The rule is auditable by arithmetic: max terrain radiance < threshold < emitter colors.

### Negative

- Emitter brightness and scene lighting are coupled through the constant; raising noon light requires retuning.

### Neutral

- Tone mapping happens once in the output pass, so HDR colors above 1.0 are safe throughout the scene graph.

## Alternatives considered

- Selective bloom via layers/two-pass rendering — doubles scene traversal for a handful of emitters.
- Lowering scene light so terrain stays under a low threshold — sacrifices the daytime look to serve a post effect.

## References

- `src/core/game.ts` (threshold), `src/effects/sky.ts`, `src/entities/crystal-towers.ts`, `src/combat/projectiles.ts`
