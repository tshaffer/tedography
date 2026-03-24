# Tedography People Pipeline: Rekognition

This pass keeps the People Pipeline provider-neutral at the service and data-model level, while adding Amazon Rekognition as the first real recognition engine behind the existing adapter interface.

## Supported engines

- `TEDOGRAPHY_PEOPLE_PIPELINE_ENGINE=mock`
- `TEDOGRAPHY_PEOPLE_PIPELINE_ENGINE=rekognition`
- `TEDOGRAPHY_PEOPLE_PIPELINE_ENGINE=none`

## Required API configuration

Set these in `apps/api/.env`:

```bash
TEDOGRAPHY_PEOPLE_PIPELINE_ENABLED=true
TEDOGRAPHY_PEOPLE_PIPELINE_ENGINE=rekognition
TEDOGRAPHY_PEOPLE_PIPELINE_REKOGNITION_REGION=us-west-2
TEDOGRAPHY_PEOPLE_PIPELINE_REKOGNITION_COLLECTION_ID=tedography-people-dev
```

AWS credentials are provided through the normal AWS SDK resolution chain. For local development, that usually means one of:

- `aws configure`
- `AWS_PROFILE=...`
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_SESSION_TOKEN`

Optional tuning:

```bash
TEDOGRAPHY_PEOPLE_PIPELINE_REKOGNITION_MAX_ATTEMPTS=3
TEDOGRAPHY_PEOPLE_PIPELINE_REKOGNITION_FACE_MATCH_THRESHOLD=0.75
TEDOGRAPHY_PEOPLE_PIPELINE_REKOGNITION_MAX_RESULTS=5
TEDOGRAPHY_PEOPLE_PIPELINE_STORE_FACE_CROPS=true
```

## Runtime behavior

When `rekognition` is selected:

- face detection uses Rekognition `DetectFaces`
- matching uses Rekognition `SearchUsersByImage`
- matching is done on per-face crops, not the full photo
- enrollment uses:
  - lazy collection creation if needed
  - Rekognition users keyed by Tedography person id
  - `IndexFaces`
  - `AssociateFaces`

Tedography keeps the provider-neutral policy:

- only `confirmed` people are written to derived `mediaAsset.people`
- `autoMatched` and `suggested` remain review states until confirmed

## Person-to-Rekognition mapping

Tedography does not use `displayName` as the Rekognition identity key.

Instead it derives a stable engine identity key from the Tedography person id:

```text
tedography-person-<person-id>
```

That avoids collisions between people with the same display name.

## Local setup

1. Install dependencies locally so the AWS SDK package is present:

```bash
pnpm install
```

2. Start the API:

```bash
pnpm --filter @tedography/api dev
```

3. Start the frontend:

```bash
pnpm --filter @tedography/web dev
```

In this repo, the typical local URLs are:

- frontend: `http://localhost:3000`
- API: `http://localhost:4000`

## End-to-end test flow

1. Open `http://localhost:3000/people/dev`
2. Create sample people
3. Process an asset
4. Confirm or assign a known-good face to a person
5. Click `Enroll <person>` on that detection
6. Reprocess that asset or another similar asset
7. Open `http://localhost:3000/people/review`
8. Verify detections and suggestions appear there
9. Confirm matches and verify derived `mediaAsset.people`

## Enrollment notes

Enrollment is intentionally minimal in this pass:

- it enrolls a Tedography person from a known-good face detection
- it uses the generated face crop as the Rekognition example image
- it does not yet provide bulk enrollment or example management

## Failure behavior

If Rekognition is unavailable or misconfigured, Tedography should fail gracefully:

- asset processing returns `processed: false`
- `skippedReason` contains the engine/config/service error message
- the rest of the app remains usable
- switching back to `mock` keeps the UI/dev harness usable without AWS

## Limitations

- no bulk enrollment UI
- no auto-enrollment of confirmed faces yet
- no face-example management UI yet
- recognition quality depends on the quality and variety of enrolled examples
- Rekognition usage can incur AWS cost and sends face crops/image bytes to AWS
