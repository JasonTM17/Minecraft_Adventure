# Security Policy

## Scope

Minecraft Adventure is a fully client-side browser game: no backend, no accounts, no network calls at runtime, and the only persisted data is block-edit state in the player's own localStorage. The realistic attack surface is limited to:

- Supply chain (npm dependencies, GitHub Actions, Docker base images)
- The static-file container image (nginx configuration, base image CVEs)
- Cross-site scripting via the page itself (the game renders no user-supplied strings)

## Supported versions

| Version | Supported |
|---|---|
| latest `main` | ✅ |
| older tags | ❌ |

## Reporting a vulnerability

Please report vulnerabilities privately by email to **jasonbmt06@gmail.com** rather than opening a public issue. Include reproduction steps and impact. You should receive a response within a week; fixes ship on `main` and are noted in the changelog.
