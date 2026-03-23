# Tedography People Pipeline v1

This adds a first-pass tedography-owned people pipeline with:

- `Person` records in the `people` collection
- `FaceDetection` records in the `faceDetections` collection
- `FaceMatchReview` records in the `faceMatchReviews` collection
- derived `mediaAsset.people` entries written only from confirmed detections
- a pluggable engine interface with `mock` and `none` adapters

## Current limitations

- There is no durable background job queue in this repo yet.
- Imported assets trigger a best-effort non-blocking background process via `setImmediate(...)`.
- The default engine is `mock`, which creates deterministic fake detections/matches for development.
- Face crops/previews are not generated in v1 even though the schema supports those fields.
- Auto-matched faces are not written to `mediaAsset.people`; only confirmed matches are.

## Configuration

Set these in `apps/api/.env` as needed:

- `TEDOGRAPHY_PEOPLE_PIPELINE_ENABLED=true`
- `TEDOGRAPHY_PEOPLE_PIPELINE_ENGINE=mock`
- `TEDOGRAPHY_PEOPLE_PIPELINE_MIN_DETECTION_CONFIDENCE=0.85`
- `TEDOGRAPHY_PEOPLE_PIPELINE_MIN_FACE_AREA_PERCENT=1.5`
- `TEDOGRAPHY_PEOPLE_PIPELINE_MIN_CROP_WIDTH_PX=120`
- `TEDOGRAPHY_PEOPLE_PIPELINE_MIN_CROP_HEIGHT_PX=120`
- `TEDOGRAPHY_PEOPLE_PIPELINE_AUTO_MATCH_THRESHOLD=0.97`
- `TEDOGRAPHY_PEOPLE_PIPELINE_REVIEW_THRESHOLD=0.8`
- `TEDOGRAPHY_PEOPLE_PIPELINE_STORE_FACE_CROPS=false`
- `TEDOGRAPHY_PEOPLE_PIPELINE_VERSION=people-pipeline-v1`

## Manual testing

Start the API:

```bash
pnpm --filter @tedography/api dev
```

Create a known person:

```bash
curl -X POST http://localhost:4000/api/people-pipeline/people \
  -H 'Content-Type: application/json' \
  -d '{"displayName":"Alice Example"}'
```

Process one asset:

```bash
curl -X POST http://localhost:4000/api/people-pipeline/assets/<asset-id>/process \
  -H 'Content-Type: application/json' \
  -d '{}'
```

Inspect detections/reviews for an asset:

```bash
curl http://localhost:4000/api/people-pipeline/assets/<asset-id>
```

Confirm or assign a face:

```bash
curl -X POST http://localhost:4000/api/people-pipeline/detections/<detection-id>/review \
  -H 'Content-Type: application/json' \
  -d '{"action":"assign","personId":"<person-id>","reviewer":"dev"}'
```

Create a new person and assign in one step:

```bash
curl -X POST http://localhost:4000/api/people-pipeline/detections/<detection-id>/review \
  -H 'Content-Type: application/json' \
  -d '{"action":"createAndAssign","displayName":"Bob Example","reviewer":"dev"}'
```

After a confirmed assignment, `mediaAsset.people` is recomputed from all confirmed detections on that asset.
