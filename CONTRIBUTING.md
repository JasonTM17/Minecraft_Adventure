# Contributing

Thanks for your interest in Minecraft Adventure! This is a personal project, but issues and pull requests are welcome.

## Development setup

```bash
npm install
npm run dev        # http://localhost:5173
```

Node 22+ recommended. No external assets or services are required — everything is procedural.

## Quality gates

All of these must pass before a PR is merged (CI runs the same commands):

```bash
npx tsc --noEmit   # strict typecheck
npm test           # vitest unit suite
npm run lint       # oxlint, warnings are errors
npm run build      # production bundle
```

Notes:

- The project builds with the TypeScript 7 native preview. `typescript-eslint` does not support it yet, which is why linting uses oxlint.
- Use `npm install` rather than `npm ci` — the lockfile is authored on Windows and lacks Linux-only optional dependencies.

## Conventions

- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/) — `feat(scope): subject`, `fix:`, `docs:`, `test:`, `build:`, `ci:`, `refactor:`, `chore:`. Imperative mood, subject ≤ 72 chars.
- **Files:** kebab-case, descriptive names (`block-edit-store.ts`); one system per class/module; consider splitting modules past ~200 lines.
- **Code:** TypeScript strict; JSDoc on public surfaces; no new runtime dependencies without discussion (the game intentionally ships only `three`).
- **Tests:** put unit tests under `tests/`, mirroring the `src/` directory layout.

## Reporting bugs

Open an issue with reproduction steps, the browser/OS, and a screenshot if visual. For security concerns see [SECURITY.md](SECURITY.md).
