# Tedography Collection Usage

This document describes the MongoDB collections that are currently active in Tedography, how each collection is used, and what user or operator actions cause writes to that collection.

The collection list in this document reflects the active API model definitions in `apps/api/src/models`.

## Scope

Current active collections:

- `mediaAssets`
- `people`
- `albumTreeNodes`
- `faceDetections`
- `faceMatchReviews`
- `personFaceExamples`
- `imageAnalyses`
- `duplicateCandidatePairs`
- `duplicateGroupResolutions`

Collections mentioned in older architecture notes such as `albums`, `pendingGroups`, `publicationRecords`, `storageInstances`, and `assetEvents` are not currently backed by active API models in this repo.

## mediaAssets

### What it stores

Canonical metadata for imported media assets.

Typical fields include:

- asset identity and filenames
- original archive path and storage root
- photo state (`New`, `Pending`, `Keep`, `Discard`)
- image dimensions and capture/location metadata
- display and thumbnail file references
- album membership via `albumIds`
- confirmed derived people tags via `people`

### How the app uses it

- Drives the main library and asset detail views.
- Supplies import, browse, review, and people features with canonical asset metadata.
- Provides the album membership relationship by storing album node ids on each asset.
- Stores the derived confirmed-people view used by search and person detail pages.

### When it is written

#### Importing files

When the user imports files from the import workflow, Tedography creates new `mediaAssets` documents.

Write behavior:

- inserts one new document per successfully registered file
- initializes `photoState` to `New`
- stores extracted metadata, storage paths, and thumbnail references
- initializes `albumIds` to `[]`
- initializes `people` to `[]`

#### Changing review state

When the user changes an asset’s review state in the UI, Tedography updates that asset’s `photoState`.

Write behavior:

- updates only `photoState`

#### Reimporting or rebuilding derived files

When the user runs asset reimport or rebuild-derived actions, Tedography updates the existing asset document.

Write behavior:

- refreshes filename, media type, dimensions, capture metadata, and location fields
- refreshes content hash and source file format
- refreshes display-path fields
- refreshes thumbnail-path fields

#### Managing albums

When the user adds assets to an album or removes assets from an album, Tedography updates `albumIds` on the affected assets.

Write behavior:

- add-to-album uses `$addToSet`
- remove-from-album uses `$pull`
- deleting an album node removes that album id from all assets that referenced it

#### People review and people pipeline processing

When the user reviews faces, merges people, splits people, or runs people processing, Tedography recomputes and updates each affected asset’s derived `people` array.

Write behavior:

- replaces the full `people` array for the affected asset
- stores only confirmed derived people, sorted deterministically

## people

### What it stores

User-visible person records.

Typical fields include:

- `displayName`
- `sortName`
- `aliases`
- `notes`
- `isHidden`
- `isArchived`

### How the app uses it

- Drives people browse, person detail, people review assignment targets, and search filters.
- Represents the durable person identity that confirmed face detections resolve to.

### When it is written

#### Creating a person directly

When the user creates a person from the people UI, Tedography inserts a new `people` document.

Write behavior:

- creates a new person with trimmed names and normalized aliases
- initializes `isHidden` to `false`
- initializes `isArchived` to `false`

#### Creating a person during face review

When the user uses “create and assign” during face review, Tedography first creates a new person and then assigns the face detection to that person.

Write behavior:

- inserts a new person document

#### Updating person metadata

When the user renames a person or changes hidden/archived flags, Tedography updates the existing person document.

Write behavior:

- updates `displayName`, `isHidden`, and/or `isArchived`

#### Splitting a person into a new person

When the user splits confirmed faces from one person into a new person, Tedography may create a new target person.

Write behavior:

- inserts a new person if the split target is a new name instead of an existing person

#### Merging people

When the user merges one person into another, Tedography does not delete the source person. It updates the source person instead.

Write behavior:

- sets the source person to `isHidden: true`
- sets the source person to `isArchived: true`

## albumTreeNodes

### What it stores

The current album tree structure for both grouping nodes and leaf album nodes.

Typical fields include:

- `label`
- `nodeType` (`Group` or `Album`)
- `parentId`
- `sortOrder`

### How the app uses it

- Drives the album tree shown in the web app.
- Defines the album hierarchy used for browsing and album membership operations.
- Replaces the older conceptual `albums` collection with a single tree-node collection.

### When it is written

#### Creating a group or album

When the user creates a new group or album in the album tree UI, Tedography inserts a new `albumTreeNodes` document.

Write behavior:

- inserts the new node
- may also update sibling `sortOrder` values to normalize ordering

#### Renaming a node

When the user renames a group or album, Tedography updates that node.

Write behavior:

- updates `label`
- updates `updatedAt`

#### Moving a node

When the user moves a group or album to a new parent, Tedography updates the moved node and any affected siblings.

Write behavior:

- updates the moved node’s `parentId`
- recomputes and updates `sortOrder` values in the source and destination sibling sets

#### Reordering within siblings

When the user moves a node up or down in the tree, Tedography updates the sibling ordering.

Write behavior:

- swaps logical order inside the sibling set
- rewrites normalized `sortOrder` values for affected siblings

#### Deleting a node

When the user deletes an album or an empty group, Tedography deletes the node document.

Write behavior:

- deletes the node
- if the deleted node is an album, related `mediaAssets.albumIds` entries are removed from assets separately

## faceDetections

### What it stores

Persisted face detections for assets processed by the people pipeline.

Typical fields include:

- `mediaAssetId`
- `faceIndex`
- face bounding box data
- crop and preview paths
- `matchedPersonId`
- `autoMatchCandidatePersonId`
- confidence fields
- `matchStatus`
- `ignoredReason`

### How the app uses it

- Powers the people review queue.
- Powers the asset-level face review dialog and person detail confirmed-face sections.
- Stores the working state of the recognition/review pipeline before that state is collapsed into `mediaAssets.people`.

### When it is written

#### Running people processing on an asset

When the user runs people processing on an asset, or when import schedules the people pipeline for a new asset, Tedography replaces all detections for that asset.

Write behavior:

- deletes all existing detections for the asset
- inserts the newly produced detections for the asset

This is a replace operation, not a per-row patch.

#### Enrolling a person from a detection

When the user enrolls a face example from an existing detection, Tedography may update the detection so the crop and preview paths are stored.

Write behavior:

- updates `cropPath`
- updates `previewPath`
- leaves the current assignment and match status intact

#### Reviewing a face detection

When the user confirms, assigns, creates-and-assigns, rejects, or ignores a detection, Tedography updates that detection.

Write behavior:

- updates `matchedPersonId`
- updates `matchConfidence`
- updates `matchStatus`
- preserves or clears candidate fields as appropriate
- updates `ignoredReason`

#### Merging people

When the user merges one person into another, Tedography updates each confirmed detection that belonged to the source person.

Write behavior:

- changes `matchedPersonId` to the target person
- keeps `matchStatus` as `confirmed`

#### Splitting confirmed detections

When the user splits selected confirmed faces to another person, Tedography updates each selected detection through the normal review path.

Write behavior:

- changes `matchedPersonId` to the selected target person
- stores the result as a confirmed assignment

## faceMatchReviews

### What it stores

The review decision associated with a face detection.

Typical fields include:

- `faceDetectionId`
- `mediaAssetId`
- suggested person and confidence
- final person
- `decision`
- `reviewer`
- `notes`
- `ignoredReason`

### How the app uses it

- Records human review decisions separately from raw detection state.
- Supports people review history, summaries, and queue presentation.
- Lets Tedography distinguish between raw machine suggestions and user-confirmed outcomes.

### When it is written

#### Running people processing on an asset

When the people pipeline processes an asset, it replaces the review rows for that asset with a fresh pending review set for the new detections.

Write behavior:

- deletes all existing reviews for the asset
- inserts a fresh set of review documents, typically with `decision: pending`

#### Reviewing a face detection

When the user confirms, assigns, rejects, or ignores a face detection, Tedography upserts the review for that detection.

Write behavior:

- creates the review if none exists
- otherwise updates the existing review in place
- sets suggested-person fields from the detection’s candidate
- sets `finalPersonId`, `decision`, `reviewer`, `notes`, and `ignoredReason`

#### Merging people

When the user merges people and a confirmed detection is directly rewritten during merge, Tedography also upserts the corresponding review record.

Write behavior:

- rewrites the review to point at the target person
- records merge-specific notes and reviewer metadata

#### Splitting confirmed detections

When the user splits confirmed faces, Tedography updates the review records through the same face-review path used by ordinary reassignment.

## personFaceExamples

### What it stores

Enrolled face examples tied to a person and a detection.

Typical fields include:

- `personId`
- `faceDetectionId`
- `mediaAssetId`
- engine-specific subject/example ids
- `status` (`active` or `removed`)
- `removedAt`

### How the app uses it

- Supplies person enrollment examples to the recognition engine.
- Tracks which detections have been explicitly enrolled as examples for a person.
- Supports person detail example management and merge/split maintenance.

### When it is written

#### Enrolling a person from a detection

When the user explicitly enrolls a detection as a person example, Tedography creates a new `personFaceExamples` document unless an active one already exists for that same person+detection pair.

Write behavior:

- inserts a new active example document

#### Removing a person example

When the user removes a person example from the person detail UI, Tedography soft-removes the example.

Write behavior:

- updates `status` from `active` to `removed`
- sets `removedAt`

#### Reassigning or unassigning detections

When the user changes a detection so that its assigned person no longer matches an active example, Tedography removes the stale example record.

Write behavior:

- updates mismatched examples to `status: removed`
- sets `removedAt`

#### Merging people

When the user merges people, Tedography may create new examples for the target person and soft-remove examples from the source person.

Write behavior:

- inserts new example records for the target person where needed
- marks source examples as removed

#### Splitting confirmed detections

When the user splits confirmed faces to another person, Tedography may create target-person examples and remove source-person examples for those detections.

## imageAnalyses

### What it stores

Fingerprinting and image-analysis output used by duplicate detection tooling.

Typical fields include:

- `assetId`
- `analysisVersion`
- width and height
- `dHash`
- `pHash`
- analysis source metadata
- `normalizedFingerprintStatus`
- `errorMessage`
- `computedAt`

### How the app uses it

- Supplies normalized image fingerprints for duplicate candidate generation.
- Supports duplicate-analysis inspection and stats tooling.
- This collection is currently maintained by duplicate-analysis tooling, not by the main web UI.

### When it is written

#### Running duplicate scan tooling

When an operator runs the duplicate scan command, Tedography upserts one `imageAnalyses` row per analyzed photo asset for the chosen analysis version.

Write behavior on success:

- upserts the record for `(assetId, analysisVersion)`
- stores width, height, hashes, source type, source path, decode strategy, status, and timestamps
- clears any previous `errorMessage`

Write behavior on failure:

- upserts the record for `(assetId, analysisVersion)`
- sets `normalizedFingerprintStatus` to `failed`
- stores `errorMessage`
- unsets prior hash and source-detail fields

There is no current normal web-app button for this. It is an operator workflow through `apps/duplicate-cli`.

## duplicateCandidatePairs

### What it stores

Pairwise duplicate candidates derived from image analyses.

Typical fields include:

- `assetIdA`
- `assetIdB`
- `analysisVersion`
- `generationVersion`
- `score`
- `classification`
- `status`
- `outcome`
- scoring `signals`

### How the app uses it

- Drives duplicate review queues.
- Feeds provisional duplicate-group derivation.
- Stores both machine-generated pair candidates and later human review state.

### When it is written

#### Running duplicate candidate generation

When an operator runs duplicate candidate generation, Tedography upserts pair rows for analyzed image pairs.

Write behavior:

- upserts one row per canonical asset pair and version combination
- stores `score`, `classification`, and `signals`
- initializes new rows with `status: unreviewed`

This is currently an operator workflow through `apps/duplicate-cli`.

#### Reviewing a candidate pair

When the user reviews a duplicate candidate pair in the duplicate review UI, Tedography updates that pair’s workflow fields.

Write behavior:

- updates `status`
- updates `outcome`

Examples:

- confirming duplicate marks the pair as reviewed and duplicate
- marking not-duplicate marks the pair as reviewed and not-duplicate
- ignoring marks the pair as ignored

#### Resolving a provisional duplicate group

When the user resolves a provisional duplicate group in the duplicate group review UI, Tedography bulk-updates affected candidate pairs.

Write behavior:

- marks all included-with-included pairs as `reviewed` + `confirmed_duplicate`
- marks included-versus-excluded pairs as `reviewed` + `not_duplicate`

This lets the pair collection stay consistent with the higher-level group decision.

## duplicateGroupResolutions

### What it stores

Saved duplicate-group resolution state for groups derived from candidate pairs.

Typical fields include:

- `groupKey`
- `assetIds`
- `proposedCanonicalAssetId`
- `manualCanonicalAssetId`
- `resolutionStatus` (`proposed` or `confirmed`)
- `confirmedAt`
- `rereviewRequiredAt`

### How the app uses it

- Persists accepted or confirmed duplicate-group decisions.
- Tracks the selected canonical asset for a resolved group.
- Tracks whether a previously confirmed group now requires rereview because lower-level pair reviews changed.

### When it is written

#### Pair-review decisions that imply a group resolution

When the user reviews an individual duplicate pair with keep-left, keep-right, or keep-both decisions, Tedography may synchronize the corresponding group resolution.

Write behavior:

- may upsert a confirmed group resolution if the pair review implies a keeper
- may downgrade an existing confirmed resolution back to `proposed` in keep-both cases

#### Resolving a provisional duplicate group

When the user resolves a provisional duplicate group, Tedography rewrites group resolutions for the overlapping assets.

Write behavior:

- deletes overlapping prior resolutions
- inserts or updates the resolved group as a confirmed resolution when at least two assets remain in the included set

#### Reopening a confirmed group

When the user reopens a provisional/confirmed duplicate group from the UI, Tedography deletes that group resolution.

Write behavior:

- deletes the row for that `groupKey`

#### Accepting the current confirmed group as final

When the user accepts a currently confirmed group as final, Tedography clears any rereview flag on that resolution.

Write behavior:

- sets `rereviewRequiredAt` to `null`

#### Guardrail-triggered rereview

When the user reviews an individual duplicate pair that touches an already confirmed group, Tedography does not let the pair review silently override the group. Instead it flags the group for rereview.

Write behavior:

- updates matching confirmed resolutions and sets `rereviewRequiredAt` to the current time

## Notes

- `albumTreeNodes` is the active persisted structure for albums. The API route still uses `/api/albums` for album membership, but the collection itself is `albumTreeNodes`.
- `people`, `faceDetections`, `faceMatchReviews`, `personFaceExamples`, and `mediaAssets.people` are all part of the current people-recognition workflow and are intentionally separate.
- `imageAnalyses`, `duplicateCandidatePairs`, and some writes to `duplicateGroupResolutions` depend on duplicate-analysis workflows that currently include CLI/operator-driven steps in addition to the web UI.
