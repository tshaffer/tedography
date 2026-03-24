# People Pipeline Dev Harness

Tedography now includes a dev-only People Pipeline test harness at:

- `/people/dev`

This page is intended to reduce or eliminate manual `curl` use while testing the People Pipeline.

## What It Does

The harness lets you:

- create people by display name
- create a default sample set (`Ted`, `Lori`, `Joel`, `Morgan`, `Annie`)
- process an asset by id
- process recent assets directly from the page
- inspect detections across all match states
- force detections into `confirmed`, `rejected`, `ignored`, `assign existing`, and `create + assign`
- inspect current derived `mediaAsset.people`

## How It Fits With `/people/review`

Use the two pages together:

1. `/people/dev`
   - seed sample people
   - process assets
   - force raw detection states
   - inspect derived asset people directly
2. `/people/review`
   - verify the actual review workflow on the same data

## Typical Local Flow

1. Enable the People Pipeline in `apps/api/.env`

```bash
TEDOGRAPHY_PEOPLE_PIPELINE_ENABLED=true
TEDOGRAPHY_PEOPLE_PIPELINE_ENGINE=mock
```

Or, to test the real AWS-backed engine:

```bash
TEDOGRAPHY_PEOPLE_PIPELINE_ENABLED=true
TEDOGRAPHY_PEOPLE_PIPELINE_ENGINE=rekognition
TEDOGRAPHY_PEOPLE_PIPELINE_REKOGNITION_REGION=us-west-2
TEDOGRAPHY_PEOPLE_PIPELINE_REKOGNITION_COLLECTION_ID=tedography-people-dev
```

2. Start the API

```bash
pnpm --filter @tedography/api dev
```

By default, the Tedography API runs on:

```text
http://localhost:4000
```

3. Start the web app

```bash
pnpm --filter @tedography/web dev
```

4. Open the frontend dev URL printed by the web server. For example, if your frontend runs on port `3000`:

```text
http://localhost:3000/people/dev
```

5. Click `Create Sample People`

6. Process one or more assets by:
   - pasting an asset id into `Process Asset`, or
   - clicking `Process` next to a recent asset

7. Use the Detection Browser to:
   - confirm
   - reject
   - ignore
   - assign an existing person
   - create and assign a new person

8. Verify `Derived Asset People` changes as expected

9. Open `/people/review` to verify the same data in the actual review screen

## Notes

- The harness is intentionally utilitarian and internal-facing.
- It uses the real people-pipeline routes where possible.
- Face crops appear when the active engine generated them. With `mock`, the harness usually falls back to the source asset thumbnail.
