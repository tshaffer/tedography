# People Review UI

Tedography now includes a minimal internal people-review workbench at:

- `/people/review`

## Purpose

This screen is intentionally admin-like. It exists to validate the People Pipeline backend in real usage before adding a fuller people-management experience.

It lets you verify:

- face detections are being persisted
- suggested and unmatched detections are visible
- review actions write correctly
- `mediaAsset.people` recomputes after each review action

## What The Screen Shows

The page loads a queue of face detections in review-relevant states by default:

- `suggested`
- `autoMatched`
- `unmatched`

It can also include:

- `rejected`
- `ignored`

Each review card shows:

- source asset thumbnail
- detection status and face index
- source asset id, filename, and archive path
- suggested person and suggested confidence
- assigned person if present
- ignored reason if present
- engine and pipeline version
- current derived `mediaAsset.people` for the asset

## Supported Actions

Each review card supports:

- confirm suggested/current person
- reject
- assign to an existing person
- create a new person and assign
- ignore face

All actions call the People Pipeline backend review route and then reload the queue so the latest derived asset people are visible.

## How To Reach It

From the main app:

- use the `People` link in the top bar

Or go directly to:

```text
http://localhost:3000/people/review
```

Use whatever frontend dev URL your local web server prints. `3000` is an example from one local setup.

## Typical Local Test Flow

1. Enable the pipeline in `apps/api/.env`

```bash
TEDOGRAPHY_PEOPLE_PIPELINE_ENABLED=true
TEDOGRAPHY_PEOPLE_PIPELINE_ENGINE=mock
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

4. Create at least one person and process at least one asset through the People Pipeline API

5. Open `/people/review`

6. Use the inline actions to confirm, reject, assign, create-and-assign, or ignore

7. Verify the `Derived Asset People` field changes as expected after each action

## Current Limitations

- Face crops/previews are not generated yet, so the page shows the source asset thumbnail rather than a cropped face image.
- The page is intentionally lightweight and does not provide broader person-management workflows yet.
