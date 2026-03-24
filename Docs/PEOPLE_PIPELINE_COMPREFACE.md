# People Pipeline CompreFace Integration

Tedography can now run the People Pipeline against a real CompreFace service by setting:

- `TEDOGRAPHY_PEOPLE_PIPELINE_ENGINE=compreface`

The existing pages continue to work:

- `/people/dev`
- `/people/review`

## Required Environment Variables

Set these in `apps/api/.env`:

```bash
TEDOGRAPHY_PEOPLE_PIPELINE_ENABLED=true
TEDOGRAPHY_PEOPLE_PIPELINE_ENGINE=compreface
TEDOGRAPHY_PEOPLE_PIPELINE_COMPREFACE_BASE_URL=http://localhost:8000
TEDOGRAPHY_PEOPLE_PIPELINE_COMPREFACE_DETECTION_API_KEY=your_detection_key
TEDOGRAPHY_PEOPLE_PIPELINE_COMPREFACE_RECOGNITION_API_KEY=your_recognition_key
```

Optional:

```bash
TEDOGRAPHY_PEOPLE_PIPELINE_COMPREFACE_API_KEY=shared_key_if_you_use_one_key_for_both
TEDOGRAPHY_PEOPLE_PIPELINE_COMPREFACE_TIMEOUT_MS=15000
TEDOGRAPHY_PEOPLE_PIPELINE_COMPREFACE_DETECTION_PROBABILITY_THRESHOLD=0.8
TEDOGRAPHY_PEOPLE_PIPELINE_STORE_FACE_CROPS=true
```

Notes:

- If you use the same CompreFace key for detection and recognition, you can set only `TEDOGRAPHY_PEOPLE_PIPELINE_COMPREFACE_API_KEY`.
- If detection or recognition needs a different key, use the specific `DETECTION_API_KEY` and `RECOGNITION_API_KEY` variables.
- If CompreFace is selected but required config is missing, Tedography will return a clear processing error instead of crashing the app.
- `TEDOGRAPHY_PEOPLE_PIPELINE_COMPREFACE_BASE_URL` is the CompreFace service URL, not the Tedography frontend or API URL. `http://localhost:8000` is only an example and should be replaced with whatever host/port your local CompreFace service actually uses.

## What Tedography Uses CompreFace For

When `compreface` is selected:

- face detection uses the CompreFace Detection service
- face matching uses the CompreFace Recognition service
- recognition is run against per-face crops when available
- face crops are stored in derived storage and exposed to the review/dev pages for preview

Confirmed matches are still the only matches written into derived `mediaAsset.people`.

## Subject Mapping

Tedography does not use CompreFace subject names as primary ids.

Instead, the adapter maps each Tedography person to a deterministic CompreFace subject key:

```text
tedography-person-<person-id>
```

This avoids display-name collisions and keeps CompreFace-specific identifiers out of higher-level workflow logic.

## Enrollment / Training

Enrollment is explicit and dev-harness driven in this pass.

Recommended workflow:

1. Open `/people/dev`
2. Create sample people or create a person manually
3. Process an asset
4. Assign or confirm a person on a good detection
5. Click `Enroll <person>` on that detection
6. Reprocess assets to get real recognition suggestions from CompreFace

The enrollment route uploads the face crop from the selected detection into the CompreFace Recognition service for that Tedography person.

## Local Development Flow

1. Start CompreFace locally and create:
   - one Detection service key
   - one Recognition service key

2. Configure `apps/api/.env` with the values above

3. Start the API:

```bash
pnpm --filter @tedography/api dev
```

By default, Tedography API runs on:

```text
http://localhost:4000
```

4. Start the web app:

```bash
pnpm --filter @tedography/web dev
```

5. Open the dev harness in the frontend dev server URL printed by the web app. For example, if your frontend runs on port `3000`:

```text
http://localhost:3000/people/dev
```

6. Create or seed people, process assets, enroll known-good detections, then reprocess assets

7. Verify results in the same frontend dev server. For example:

```text
http://localhost:3000/people/review
```

## Graceful Failure Behavior

If CompreFace is:

- unreachable
- timing out
- returning invalid responses
- missing required API keys

then Tedography will fail that People Pipeline processing request clearly and return a readable error. The rest of the application remains usable.

## Current Limitations

- Enrollment is manual; there is no bulk subject-management UI yet.
- Tedography does not automatically enroll every confirmed face example.
- Per-person example management in CompreFace is not exposed yet.
- Matching quality depends on the quality and quantity of enrolled examples.
- The current UI shows stored face crops when available, but it is still an internal/admin workflow rather than a polished end-user experience.
