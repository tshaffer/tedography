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
- confidence and sort order are usable enough for real-corpus validation

## What The Screen Shows

The page loads a queue of face detections in review-relevant states by default:

- `suggested`
- `autoMatched`
- `unmatched`

It can also include:

- `confirmed`
- `rejected`
- `ignored`

Each review card shows:

- face crop preview when available
- source asset thumbnail
- detection status and face index
- a short status summary explaining whether the face is still reviewable or already confirmed into derived asset people
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
- enroll a confirmed person example into the active recognition engine

All actions call the People Pipeline backend review route and then reload the queue so the latest derived asset people are visible.

The page also supports queue sorting for validation:

- newest first
- highest confidence
- lowest confidence
- filename
- asset id

## How To Reach It

From the main app:

- use the `People` link in the top bar
- or, from `Library`, select one or more assets and click `Run People Recognition`

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

4. Create at least one person and process at least one asset through the People Pipeline API

5. Open `/people/review`

6. Use the inline actions to confirm, reject, assign, create-and-assign, or ignore

7. Verify the `Derived Asset People` field changes as expected after each action

## Library Shortcut

The main `Library` page now includes a selection-based action:

- `Run People Recognition`

Behavior:

- if one asset is selected, Tedography processes that asset and shows a `Review Faces` follow-up link
- if multiple assets are selected, Tedography processes all selected assets and reports success / partial failure
- if no assets are selected, the action is disabled

For single-asset runs, the follow-up link opens:

```text
/people/review?assetId=<asset-id>
```

so the People Review page is immediately filtered to that asset.

When the page is filtered to a single asset, it now also shows a visible asset-scoped banner so it is obvious that:

- the queue is scoped to one asset
- review actions are affecting that asset only
- only confirmed matches become derived `mediaAsset.people`

When exactly one asset is selected in `Library`, the inspector now also shows a compact `People` section with:

- detections count
- reviewable count
- confirmed people names
- a small note explaining whether the asset still needs review or already has confirmed derived people
- a primary `Review Faces` action that opens an in-context asset-scoped review dialog without leaving `Library`
- an `Open Full People Review` link for the standalone queue/page flow

## Phase 1 Validation Loop

For the current Practical Validation UI phase, the intended loop is:

1. In `Library`, select one asset and click `Run People Recognition`
2. Check the `People` section in the inspector:
   - detections
   - reviewable faces
   - confirmed people
3. Click `Review Faces`
4. In the asset-scoped review dialog, confirm, reject, assign, create-and-assign, ignore, or enroll from a confirmed detection
5. Verify `Derived Asset People` in the dialog
6. Close the dialog and confirm the `Library` inspector now reflects the same confirmed people
7. Use `Open Full People Review` when you want the standalone queue-based workflow instead of the in-context asset modal

## Modal Vs Full Page

Use the in-context asset review dialog when:

- you are already in `Library`
- you want to review faces for one selected asset
- you want to keep the same Library selection and scroll context

Use the standalone `/people/review` page when:

- you want a broader queue across many assets
- you want explicit queue sorting/filtering controls
- you are doing batch/admin-style people review

## Current Limitations

- Face crops/previews are shown when the active engine generated them. With `mock`, the page usually falls back to the source asset thumbnail.
- The page is intentionally lightweight and does not provide broader person-management workflows yet.
