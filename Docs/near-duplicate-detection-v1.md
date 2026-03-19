# Near-Duplicate Detection v1

## Purpose

Provide a separate, iteration-friendly foundation for near-duplicate image analysis in Tedography without adding complexity to the main review UI yet.

## Scope of v1

- separate monorepo apps/packages for duplicate analysis
- perceptual descriptor extraction and persistence
- CLI-driven scanning and stats
- no duplicate review workflow in the main app
- no candidate grouping, clustering, embeddings, or destructive actions

## Phase plan

### Phase 0

- workspace scaffolding
- shared domain/types package
- image analysis package
- stub worker and review web app

### Phase 1

- image normalization
- dHash
- pHash
- image analysis record persistence
- duplicate CLI scan/stats commands

### Phase 2

- candidate-pair generation
- review-specific backend endpoints
- dedicated duplicate review UI

## Current status

- Phase 0 implemented
- Phase 1 implemented with descriptor extraction, persistence, and CLI scan/stats/inspect
- Phase 2 implemented in a conservative CLI-first form with persisted candidate-pair generation
- Candidate review UI, grouping, and clustering are still not started
