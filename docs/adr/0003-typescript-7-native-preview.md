# 3. TypeScript 7 native preview as the compiler

Date: 2026-07-26

## Status

Accepted

## Context

The project wants strict typechecking on every commit. The TypeScript 7 native (Go) compiler preview typechecks this codebase roughly 10× faster than tsc 5.x, which matters when `tsc --noEmit` gates every commit and CI run.

## Decision

Build and typecheck with the TypeScript 7 native preview (`typescript@^7.0.2`). Accept that parts of the ecosystem which link against the TS 5.x compiler API do not work yet, and choose tools that do not depend on that API.

## Consequences

### Positive

- Sub-second strict typechecks locally and in CI.

### Negative

- `typescript-eslint` is incompatible (import-time version gate plus a crash on the removed `ts.Extension` enum in typescript-estree). Linting therefore uses oxlint, which has its own parser. Revisit if typescript-eslint ships TS 7 support (tracked upstream in typescript-eslint issue #10940).
- The Windows-authored lockfile omits Linux-only optional deps of the native preview, so containers must use `npm install` rather than `npm ci`.

### Neutral

- CSS side-effect imports need an explicit `src/vite-env.d.ts` reference for the preview's module resolution.

## Alternatives considered

- Stay on tsc 5.x — slower gates on every commit for compatibility we can route around.
- Dual TypeScript versions (5.x for lint tooling only) — two compilers to keep in sync for one tool's benefit.

## References

- https://github.com/typescript-eslint/typescript-eslint/issues/10940
- `CONTRIBUTING.md` (quality gates), `Dockerfile` (npm install note)
