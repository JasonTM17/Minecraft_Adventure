# 1. Record architecture decisions

Date: 2026-07-26

## Status

Accepted

## Context

The project accumulated significant technical decisions (rendering pipeline, persistence model, toolchain choices) that were only recorded in commit messages. Future changes need the reasoning, not just the result.

## Decision

We record architecture decisions as numbered, append-only ADR files in `docs/adr/`, one decision per file, using the template in `template.md`. Accepted ADRs are never edited; they are superseded by new ADRs.

## Consequences

### Positive

- Reasoning survives beyond commit messages and can be linked from reviews.

### Negative

- Small documentation overhead per significant decision.

### Neutral

- The record starts now; earlier decisions are back-filled as ADRs 0002–0006.

## Alternatives considered

- Keeping decisions in commit messages only — loses the alternatives-considered context.
- A single DECISIONS.md — grows unboundedly and encourages editing history.

## References

- https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions
