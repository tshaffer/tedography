# Duplicate Role Data Flow

This note explains:

- whether `Keeper` / `Duplicate` are enums
- whether those values come directly from the database or are derived programmatically
- what other duplicate/similarity-related values exist
- the current data flow from MongoDB to the Inspector's `Duplicate Role` field

## Short Answer

`Keeper` and `Duplicate` are not stored as literal enum values on `mediaAssets`.

Instead:

- Mongo persists duplicate group resolution data in `duplicateGroupResolutions`
- the API returns duplicate groups with a `selectedCanonicalAssetId`
- the web app derives a per-asset role from that:
  - canonical asset -> `Keeper`
  - non-canonical asset in the same confirmed group -> `Duplicate`

So the final UI label is determined programmatically from duplicate group data, not by a direct `mediaAssets` query for `"Keeper"` or `"Duplicate"`.

## Relevant Types

### Group member decisions

In group review, the explicit member decision type is:

File: [packages/shared/src/api/duplicateCandidatePairs.ts](/Users/tedshaffer/Documents/Projects/tedography/packages/shared/src/api/duplicateCandidatePairs.ts)

```ts
export type DuplicateProvisionalGroupMemberDecision =
  'keeper' | 'duplicate' | 'not_in_group' | 'unclassified';
```

These are the values used while reviewing a provisional duplicate group.

### Visibility role used by the Library/Inspector

In the web app, the duplicate visibility summary uses:

File: [apps/web/src/components/duplicates/duplicateResolutionVisibility.ts](/Users/tedshaffer/Documents/Projects/tedography/apps/web/src/components/duplicates/duplicateResolutionVisibility.ts)

```ts
role: 'canonical' | 'secondary'
```

That role is then mapped to the user-facing labels:

- `canonical` -> `Keeper`
- `secondary` -> `Duplicate`

## Is Keeper / Duplicate Determined Programmatically or by Direct DB Query?

Both, in sequence.

### Persisted data in MongoDB

Mongo stores duplicate group resolution records in `duplicateGroupResolutions`.

Relevant fields include:

- `groupKey`
- `assetIds`
- `proposedCanonicalAssetId`
- `manualCanonicalAssetId`
- `resolutionStatus`

File: [apps/api/src/repositories/duplicateGroupResolutionRepository.ts](/Users/tedshaffer/Documents/Projects/tedography/apps/api/src/repositories/duplicateGroupResolutionRepository.ts)

The canonical asset is not stored as the string `"Keeper"`. Instead, it is represented by the selected canonical asset ID.

### Programmatic role derivation

The UI computes the role per asset from the selected canonical asset:

File: [apps/web/src/components/duplicates/duplicateResolutionVisibility.ts](/Users/tedshaffer/Documents/Projects/tedography/apps/web/src/components/duplicates/duplicateResolutionVisibility.ts)

Logic:

- if `assetId === selectedCanonicalAssetId`, role = `canonical`
- otherwise role = `secondary`

Then:

- `canonical` displays as `Keeper`
- `secondary` displays as `Duplicate`

So the visible role is derived programmatically from group resolution data.

## Other Values Related to Duplicate / Similarity

There are several related value sets in the system.

### Candidate pair classification

These describe how strongly two images are believed to match:

File: [packages/shared/src/api/duplicateCandidatePairs.ts](/Users/tedshaffer/Documents/Projects/tedography/packages/shared/src/api/duplicateCandidatePairs.ts)

- `very_likely_duplicate`
- `possible_duplicate`
- `similar_image`

`similar_image` is important because it is similarity-related, but it does not mean the pair has been confirmed as duplicates.

### Candidate pair review outcome

These describe the review result for a pair:

File: [packages/shared/src/api/duplicateCandidatePairs.ts](/Users/tedshaffer/Documents/Projects/tedography/packages/shared/src/api/duplicateCandidatePairs.ts)

- `confirmed_duplicate`
- `not_duplicate`
- `ignored`

### Candidate pair review decision

These are UI/API review actions for a pair:

File: [packages/shared/src/api/duplicateCandidatePairs.ts](/Users/tedshaffer/Documents/Projects/tedography/packages/shared/src/api/duplicateCandidatePairs.ts)

- `confirmed_duplicate`
- `not_duplicate`
- `ignored`
- `reviewed_uncertain`
- `confirmed_duplicate_keep_both`
- `confirmed_duplicate_keep_left`
- `confirmed_duplicate_keep_right`

### Provisional duplicate group member decisions

For group review:

- `keeper`
- `duplicate`
- `not_in_group`
- `unclassified`

### Duplicate group review status

For provisional groups:

- `unresolved`
- `resolved`
- `needs_rereview`

## End-to-End Data Flow: MongoDB to Inspector

This is the current path for the Inspector's `Duplicate Role` field.

### 1. Mongo stores duplicate group resolutions

Collection:

- `duplicateGroupResolutions`

Repository access:

File: [apps/api/src/repositories/duplicateGroupResolutionRepository.ts](/Users/tedshaffer/Documents/Projects/tedography/apps/api/src/repositories/duplicateGroupResolutionRepository.ts)

The repository returns resolution documents including:

- `groupKey`
- `assetIds`
- `proposedCanonicalAssetId`
- `manualCanonicalAssetId`
- `resolutionStatus`

### 2. API builds derived duplicate groups

Route:

File: [apps/api/src/routes/duplicateCandidatePairRoutes.ts](/Users/tedshaffer/Documents/Projects/tedography/apps/api/src/routes/duplicateCandidatePairRoutes.ts)

Endpoint:

- `GET /api/duplicate-candidate-pairs/groups`

This route calls:

- `listDerivedDuplicateGroups(...)`

File: [apps/api/src/services/duplicateGroupService.ts](/Users/tedshaffer/Documents/Projects/tedography/apps/api/src/services/duplicateGroupService.ts)

That service builds group list items and resolves a single canonical asset for each group using the persisted group resolution data.

### 3. Web app fetches duplicate groups

The web app requests duplicate groups via:

File: [apps/web/src/api/duplicateCandidatePairApi.ts](/Users/tedshaffer/Documents/Projects/tedography/apps/web/src/api/duplicateCandidatePairApi.ts)

Function:

- `listDuplicateGroups()`

This fetches:

- `/api/duplicate-candidate-pairs/groups`

### 4. App converts duplicate groups into an asset-level visibility map

File: [apps/web/src/App.tsx](/Users/tedshaffer/Documents/Projects/tedography/apps/web/src/App.tsx)

Function:

- `loadDuplicateResolutionVisibility()`

It does:

1. call `listDuplicateGroups()`
2. pass the result into `buildDuplicateResolutionVisibilityMap(...)`

The map builder is here:

File: [apps/web/src/components/duplicates/duplicateResolutionVisibility.ts](/Users/tedshaffer/Documents/Projects/tedography/apps/web/src/components/duplicates/duplicateResolutionVisibility.ts)

It creates one summary per asset:

- `assetId`
- `groupKey`
- `selectedCanonicalAssetId`
- `role: 'canonical' | 'secondary'`
- `isSuppressedByDefault`
- `resolutionStatus: 'confirmed'`

### 5. App looks up the selected asset in that map

File: [apps/web/src/App.tsx](/Users/tedshaffer/Documents/Projects/tedography/apps/web/src/App.tsx)

`selectedAssetDuplicateResolution` is derived by looking up the currently selected asset ID in `duplicateResolutionVisibilityByAssetId`.

### 6. Inspector displays the derived role

Files:

- [apps/web/src/App.tsx](/Users/tedshaffer/Documents/Projects/tedography/apps/web/src/App.tsx)
- [apps/web/src/components/assets/AssetDetailsPanel.tsx](/Users/tedshaffer/Documents/Projects/tedography/apps/web/src/components/assets/AssetDetailsPanel.tsx)

Inspector logic:

- if `role === 'canonical'`, show `Canonical keeper`
- otherwise show `Suppressed duplicate`

Other display helpers use the same summary and map:

File: [apps/web/src/components/duplicates/duplicateResolutionVisibility.ts](/Users/tedshaffer/Documents/Projects/tedography/apps/web/src/components/duplicates/duplicateResolutionVisibility.ts)

- `canonical` -> badge label `Keeper`
- `secondary` -> badge label `Duplicate`

## Practical Conclusion

If you want to know whether a media item is treated as a duplicate keeper or duplicate:

- do not look for a `Keeper` / `Duplicate` enum on the media item itself
- instead look for confirmed duplicate group membership plus the selected canonical asset for that group

In effect:

- confirmed group membership + selected canonical asset ID = source of truth
- Keeper / Duplicate labels = derived presentation layer

## Relationship to PhotoState

`PhotoState` and duplicate state are mostly separate systems.

`PhotoState` is the review/workflow state of a media item:

- `New`
- `Pending`
- `Keep`
- `Discard`

Duplicate state is modeled separately through:

- duplicate candidate pairs
- duplicate group resolutions
- derived duplicate visibility summaries
- derived roles such as `Keeper` / `Duplicate`

So there is no single shared enum or field where duplicate role is stored as a `PhotoState`.

That said, they can both apply to the same media item at the same time, and some code/reporting paths do combine them.

## Examples Where PhotoState and Duplicate State Are Combined

### 1. Combined reporting/query: "Discard or Duplicate"

There is a concrete Mongo shell script in:

File: [Docs/discardedOrDuplicateCountQuery.js](/Users/tedshaffer/Documents/Projects/tedography/Docs/discardedOrDuplicateCountQuery.js)

This script computes the union of:

- media items where `photoState === "Discard"`
- media items that are confirmed duplicate non-canonical assets

without double-counting items that satisfy both.

That is a direct example of reporting that combines `PhotoState` and duplicate state.

### 2. Library visibility combines photo-state filtering and duplicate suppression

In the web app, the visible asset list is built by applying:

- photo-state filtering
- duplicate suppression for confirmed secondary duplicates

Relevant files:

- [apps/web/src/App.tsx](/Users/tedshaffer/Documents/Projects/tedography/apps/web/src/App.tsx)
- [apps/web/src/components/duplicates/duplicateResolutionVisibility.ts](/Users/tedshaffer/Documents/Projects/tedography/apps/web/src/components/duplicates/duplicateResolutionVisibility.ts)

This is not the same as storing duplicate role in `PhotoState`, but it is an example of both systems affecting what the user sees at the same time.

### 3. Duplicate-group ranking logic uses PhotoState as one signal

In the API duplicate-group service, there is a helper:

File: [apps/api/src/services/duplicateGroupService.ts](/Users/tedshaffer/Documents/Projects/tedography/apps/api/src/services/duplicateGroupService.ts)

- `getPhotoStateRank(photoState)`

It ranks:

- `Keep` highest
- then `Pending`
- then `New`
- with `Discard` lowest

That means duplicate-group/canonical-selection logic is aware of `PhotoState` as one ranking signal, even though duplicate role is still modeled separately.
