# People Pipeline v1 Implementation Summary

Implemented the backend/domain foundation for People Pipeline v1.

## What Changed

### Domain

Added `FaceDetection`, `FaceMatchReview`, richer `Person`, and derived `mediaAsset.people` support in:

- `packages/domain/src/entities/FaceDetection.ts`
- `packages/domain/src/entities/FaceMatchReview.ts`
- `packages/domain/src/entities/Person.ts`
- `packages/domain/src/entities/MediaAsset.ts`

### Shared Contracts

Added people-pipeline API types in:

- `packages/shared/src/api/peoplePipeline.ts`

### API Backend

Added Mongoose models for people, faces, and reviews in:

- `apps/api/src/models/personModel.ts`
- `apps/api/src/models/faceDetectionModel.ts`
- `apps/api/src/models/faceMatchReviewModel.ts`

Added repositories in:

- `apps/api/src/repositories/personRepository.ts`
- `apps/api/src/repositories/faceDetectionRepository.ts`
- `apps/api/src/repositories/faceMatchReviewRepository.ts`

Added pluggable engine interface and adapters in:

- `apps/api/src/people/recognitionEngine.ts`
- `apps/api/src/people/mockRecognitionEngine.ts`
- `apps/api/src/people/noopRecognitionEngine.ts`
- `apps/api/src/people/engineFactory.ts`

Added processing and review logic in:

- `apps/api/src/people/peoplePipelineService.ts`

Added minimal dev/admin routes in:

- `apps/api/src/routes/peoplePipelineRoutes.ts`

Added config in:

- `apps/api/src/config.ts`

### Integration

`mediaAsset.people` is now stored on the asset schema and recomputed from confirmed detections only.

New imports trigger a best-effort non-blocking background people-processing call from:

- `apps/api/src/import/registerImportService.ts`

Server startup now mounts the route and syncs indexes in:

- `apps/api/src/server.ts`
- `apps/api/src/index.ts`

### Docs and Tests

Added:

- `docs/PEOPLE_PIPELINE_V1.md`
- `apps/api/src/people/peoplePipelineService.test.ts`

## Key Behavior

`mediaAsset.people` is treated as derived and is only populated from `FaceDetection.matchStatus === 'confirmed'`.

Matching is conservative:

- high confidence => `autoMatched`
- medium confidence => `suggested`
- low confidence => `unmatched`
- ignored faces => `ignored`

`autoMatched` does not automatically write into `mediaAsset.people`.

Review actions support:

- `confirm`
- `reject`
- `assign` to existing person
- `createAndAssign`
- `ignore`

## Assumptions and Divergences

- The repo does not currently have a durable background job system. This implementation uses a non-blocking `setImmediate(...)` import trigger plus explicit API routes for manual processing.
- The `docs/TEDOGRAPHY_ARCHITECTURE.md` path referenced in repo instructions does not exist in this branch; implementation followed the actual repo structure instead.
- The real recognition engine is still a stub/mock in this pass. The interface is pluggable, but the default `mock` engine generates deterministic fake detections and matches for development.
- Face crop generation was not added yet; schema fields exist but remain `null`.

## How To Test Locally

Set env in `apps/api/.env`:

```bash
TEDOGRAPHY_PEOPLE_PIPELINE_ENABLED=true
TEDOGRAPHY_PEOPLE_PIPELINE_ENGINE=mock
```

Start the API:

```bash
pnpm --filter @tedography/api dev
```

Create a person:

```bash
curl -X POST http://localhost:4000/api/people-pipeline/people \
  -H 'Content-Type: application/json' \
  -d '{"displayName":"Alice Example"}'
```

Process an asset:

```bash
curl -X POST http://localhost:4000/api/people-pipeline/assets/<asset-id>/process \
  -H 'Content-Type: application/json' \
  -d '{}'
```

Inspect detections:

```bash
curl http://localhost:4000/api/people-pipeline/assets/<asset-id>
```

Assign or confirm a face:

```bash
curl -X POST http://localhost:4000/api/people-pipeline/detections/<detection-id>/review \
  -H 'Content-Type: application/json' \
  -d '{"action":"assign","personId":"<person-id>","reviewer":"dev"}'
```

Create and assign in one step:

```bash
curl -X POST http://localhost:4000/api/people-pipeline/detections/<detection-id>/review \
  -H 'Content-Type: application/json' \
  -d '{"action":"createAndAssign","displayName":"Bob Example","reviewer":"dev"}'
```

## Verification Run

```bash
pnpm -r typecheck
pnpm --filter @tedography/api exec node --import tsx --test src/people/peoplePipelineService.test.ts
```

## Natural Next Steps

- A minimal review UI for `/duplicates/review`-style face confirmation
- A real engine adapter behind the interface
