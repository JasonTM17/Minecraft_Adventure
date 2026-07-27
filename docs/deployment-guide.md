# Deployment Guide

The game is a fully static site — any web server that can serve files can host it.

## Local development

```bash
npm install        # NOT npm ci — see note below
npm run dev        # Vite dev server, http://localhost:5173
```

## Production build

```bash
npm run build      # tsc --noEmit && vite build → dist/
npm run preview    # serve dist/ locally for a smoke test
```

`dist/` is self-contained (one HTML, one JS, one CSS; zero external assets) and can be uploaded to any static host (nginx, GitHub Pages, S3, …).

## Docker

```bash
docker compose up --build     # http://localhost:8080
```

Image anatomy (`Dockerfile`):

- **Builder** — `node:22-alpine`, `npm install`, `npm run build`.
- **Runtime** — `nginxinc/nginx-unprivileged:1.27-alpine` (non-root, port 8080) serving `dist/`, with a `wget` healthcheck every 30 s and OCI labels (`org.opencontainers.image.revision` from the `GIT_SHA` build arg).
- Size ≈ 75 MB.

```bash
docker build --build-arg GIT_SHA=$(git rev-parse HEAD) -t minecraft-adventure .
```

### Why `npm install`, not `npm ci`

The lockfile is authored on Windows and omits Linux-only optional dependencies of the TypeScript 7 native preview; strict `npm ci` fails inside Linux containers. `npm install` resolves them at build time against the committed lockfile.

## CI/CD (GitHub Actions, activates on push to GitHub)

| Workflow | Trigger | Does |
|---|---|---|
| `ci.yml` | push/PR to main | install → typecheck → test → lint → build, uploads `dist/` artifact |
| `docker-publish.yml` | push to main | buildx amd64+arm64 → Docker Hub `nguyenson1710/minecraft-adventure-web:latest` + `:<sha>` AND GitHub Container Registry `ghcr.io/jasontm17/minecraft-adventure-web:latest` + `:<sha>` |
| `codeql.yml` | push/PR + weekly | SAST for JS/TS |
| `trivy.yml` | push/PR | CRITICAL/HIGH scan of the filesystem and built image |

`docker-publish` needs two repository secrets: `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` (Settings → Secrets and variables → Actions). Without them the Docker Hub push is skipped. The GitHub Container Registry (ghcr.io) push uses the automatic `GITHUB_TOKEN` (granted `packages: write` in the workflow), so it needs no extra secret — the image appears on the repo's Packages tab.

## Runtime state

The game persists exactly one thing: player block edits, in the browser's localStorage under `mcadv-edits-<seed>`. Clearing site data resets the world to pristine terrain. There is no server-side state anywhere.
