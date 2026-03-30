# Tedography Duplicate Group UI Implementation Plan

This document translates the agreed duplicate-group product spec into a concrete implementation plan against the current Tedography codebase.

It is intentionally practical and file-oriented.

## Current State In Repo

### Existing Duplicate UI

Current duplicate UI is pair-oriented:

- route: [`/duplicates/review`](../apps/web/src/main.tsx)
- component: [`apps/web/src/components/duplicates/DuplicateReviewPage.tsx`](../apps/web/src/components/duplicates/DuplicateReviewPage.tsx)

There is currently **no** implemented `/duplicates/groups` route in the actual app, even though older docs mention one.

### Existing Duplicate Backend

Current duplicate backend is centered on:

- pair review routes:
  - [`apps/api/src/routes/duplicateCandidatePairRoutes.ts`](../apps/api/src/routes/duplicateCandidatePairRoutes.ts)
- pair review service:
  - [`apps/api/src/services/duplicateCandidatePairService.ts`](../apps/api/src/services/duplicateCandidatePairService.ts)
- duplicate-group derivation and canonical selection:
  - [`apps/api/src/services/duplicateGroupService.ts`](../apps/api/src/services/duplicateGroupService.ts)

### Existing Duplicate Models

Current persisted models:

- duplicate candidate pairs:
  - [`apps/api/src/models/duplicateCandidatePairModel.ts`](../apps/api/src/models/duplicateCandidatePairModel.ts)
- duplicate group resolutions:
  - [`apps/api/src/models/duplicateGroupResolutionModel.ts`](../apps/api/src/models/duplicateGroupResolutionModel.ts)

### Existing Frontend Duplicate Visibility

Library duplicate badges and suppression already depend on:

- [`apps/web/src/components/duplicates/duplicateResolutionVisibility.ts`](../apps/web/src/components/duplicates/duplicateResolutionVisibility.ts)
- duplicate visibility loading in:
  - [`apps/web/src/App.tsx`](../apps/web/src/App.tsx)

## Guiding Product Decisions

This plan assumes the following agreed rules:

- the new duplicate-group UI is authoritative for final group resolution
- historical pair markings are hints only
- a group is complete when exactly one keeper is selected and every other shown asset is explicitly classified
- excluded assets are removed from the current group only and may later appear in other candidate groups
- singleton leftovers leave the current group and are only revisited if they still have candidate links elsewhere
- resolved groups are stable, but not permanent
- if new candidate evidence later connects to a resolved group, the group is marked `Needs Re-review`
- resolved groups are manually reopenable

## Implementation Strategy

Implement this in three layers:

1. shared API and backend support for provisional duplicate groups and group resolution
2. new duplicate-group review route and UI
3. integration with existing Library duplicate visibility and legacy pair-review data

The implementation should **add** a new group-oriented workflow without removing the current pair-review workflow.

## Phase 1: Shared Types And API Contract

### Files To Update

- [`packages/shared/src/api/duplicateCandidatePairs.ts`](../packages/shared/src/api/duplicateCandidatePairs.ts)

### Additions

Add new shared types for the new UI:

- `DuplicateGroupReviewStatus`
  - likely values:
    - `unresolved`
    - `resolved`
    - `needs_rereview`

- `DuplicateGroupMemberHistoricalCounts`
  - keeper count
  - duplicate count
  - not-duplicate count
  - optionally uncertain/unreviewed counts if included in v1

- `DuplicateGroupMemberDecision`
  - `keeper`
  - `duplicate`
  - `not_in_group`
  - optionally `unclassified` for in-progress UI state

- `ProvisionalDuplicateGroupMember`
  - asset summary
  - historical counts
  - current resolved role if any

- `ProvisionalDuplicateGroupListItem`
  - group key
  - asset ids
  - member list
  - group review status
  - derived candidate pair count
  - selected keeper if currently resolved
  - source label(s) if useful later

- request/response contracts for:
  - list provisional duplicate groups
  - get a single provisional duplicate group
  - save group resolution
  - reopen group

### Notes

Do not overload the old pair-review response shapes for this.

The new UI needs its own clearer group-oriented API contract.

## Phase 2: Backend Group Derivation For Candidate Groups

### Files To Update

- [`apps/api/src/services/duplicateGroupService.ts`](../apps/api/src/services/duplicateGroupService.ts)
- [`apps/api/src/repositories/duplicateCandidatePairRepository.ts`](../apps/api/src/repositories/duplicateCandidatePairRepository.ts)
- possibly:
  - [`apps/api/src/repositories/duplicateGroupResolutionRepository.ts`](../apps/api/src/repositories/duplicateGroupResolutionRepository.ts)

### Backend Goal

Add a new service path that derives **provisional candidate groups** from duplicate-candidate relationships, not only confirmed duplicate groups.

### Required New Repository Support

In [`duplicateCandidatePairRepository.ts`](../apps/api/src/repositories/duplicateCandidatePairRepository.ts), add repository helpers to:

- list candidate pairs for group derivation
- filter by:
  - unreviewed / reviewed / ignored as needed
  - classification threshold
  - score threshold if desired
- likely exclude `not_duplicate` reviewed pairs from provisional connectivity

### Required New Service Support

In [`duplicateGroupService.ts`](../apps/api/src/services/duplicateGroupService.ts), add a second derivation path alongside the current confirmed-group derivation:

- existing:
  - derive confirmed duplicate groups from confirmed duplicate pairs
- new:
  - derive provisional candidate groups from duplicate-candidate links

This new path should:

- build connected components from candidate relationships
- allow resolved groups to still be surfaced as `resolved` or `needs_rereview`
- attach resolved-group info when a provisional group corresponds to or overlaps an existing duplicate-group resolution

### Important Semantics

For v1, the provisional candidate group derivation should be conservative and understandable:

- use candidate links that are still relevant
- do not silently collapse everything into confirmed groups only
- allow unresolved candidate members to reopen earlier resolved groups if new connectivity appears

## Phase 3: Historical Pair-Review Counts Per Asset

### Files To Update

- [`apps/api/src/repositories/duplicateCandidatePairRepository.ts`](../apps/api/src/repositories/duplicateCandidatePairRepository.ts)
- [`apps/api/src/services/duplicateGroupService.ts`](../apps/api/src/services/duplicateGroupService.ts)

### Goal

Provide per-asset historical review counts to show in the new group UI.

### Needed Behavior

For each asset shown in a provisional group, compute counts like:

- keeper count
- duplicate count
- not-duplicate count

### Important Constraint

Current `duplicateCandidatePairs` data stores:

- `status`
- `outcome`

but does **not** fully preserve keeper direction as a first-class field in a durable, query-friendly way.

Therefore the implementation will need to decide one of these:

1. derive keeper/duplicate historical counts from existing group resolution data and available pair-review context
2. add a new persisted per-pair directional review record going forward
3. support mixed logic:
   - best-effort historical counts for old data
   - exact directional counts for new data after this feature lands

### Recommendation

Implement a pragmatic v1:

- use existing data to derive approximate historical counts where possible
- explicitly document that older pair-review history may not support perfect keeper-direction reconstruction in every case
- if needed, add new directional fields only for future reviews, but do not block the new UI on perfect backfill

This is the biggest data-model caveat in the whole feature.

## Phase 4: Group Resolution Persistence

### Files To Update

- [`apps/api/src/models/duplicateGroupResolutionModel.ts`](../apps/api/src/models/duplicateGroupResolutionModel.ts)
- [`apps/api/src/repositories/duplicateGroupResolutionRepository.ts`](../apps/api/src/repositories/duplicateGroupResolutionRepository.ts)
- [`apps/api/src/services/duplicateGroupService.ts`](../apps/api/src/services/duplicateCandidatePairService.ts)

### Goal

Extend duplicate-group resolution so it can represent the new UI’s authoritative outcome.

### Model Changes

Current group resolution persists:

- `groupKey`
- `assetIds`
- `proposedCanonicalAssetId`
- `manualCanonicalAssetId`
- `resolutionStatus`

The new UI needs additional persisted semantics, at minimum:

- explicit review status:
  - unresolved
  - resolved
  - needs rereview
- timestamp for last authoritative group-resolution review
- optionally a marker that the group was resolved by the new group UI

### Recommended Additions

Add fields like:

- `reviewStatus`
- `resolvedAt`
- `requiresRereviewAt` or equivalent

Keep the current canonical fields, because Library duplicate behavior already depends on them.

### Excluded Assets

Do **not** store excluded assets as members of the resolved duplicate group.

Excluded assets should simply be absent from the resolved asset set and remain eligible for later candidate regrouping.

## Phase 5: New Backend Routes

### Files To Update

- [`apps/api/src/routes/duplicateCandidatePairRoutes.ts`](../apps/api/src/routes/duplicateCandidatePairRoutes.ts)

### Add New Endpoints

Keep the current pair-review endpoints intact.

Add new group-oriented endpoints such as:

- `GET /api/duplicate-candidate-pairs/provisional-groups`
  - list provisional groups for the new UI
- `GET /api/duplicate-candidate-pairs/provisional-groups/:groupKey`
  - load one group in full detail
- `POST /api/duplicate-candidate-pairs/provisional-groups/:groupKey/resolve`
  - save one keeper + duplicates + excluded assets
- `POST /api/duplicate-candidate-pairs/provisional-groups/:groupKey/reopen`
  - reopen a previously resolved group

### Route Responsibilities

The resolve route should:

- validate there is exactly one keeper
- validate every member is explicitly classified
- persist the resolved duplicate group
- mark current group state authoritative
- update duplicate visibility consequences for Library
- mark future rereview if new candidate connectivity later expands that set

## Phase 6: Frontend API Layer

### Files To Update

- [`apps/web/src/api/duplicateCandidatePairApi.ts`](../apps/web/src/api/duplicateCandidatePairApi.ts)

### Additions

Add new API functions matching the backend routes:

- `listProvisionalDuplicateGroups(...)`
- `getProvisionalDuplicateGroup(groupKey)`
- `resolveProvisionalDuplicateGroup(groupKey, request)`
- `reopenProvisionalDuplicateGroup(groupKey)`

Keep the existing pair-review API functions unchanged.

## Phase 7: New Duplicate Group Review Page

### Files To Add

- [`apps/web/src/components/duplicates/DuplicateGroupReviewPage.tsx`](../apps/web/src/components/duplicates/DuplicateGroupReviewPage.tsx)

### Optional Helper Files To Add

- [`apps/web/src/components/duplicates/duplicateGroupReviewState.ts`](../apps/web/src/components/duplicates/duplicateGroupReviewState.ts)
- [`apps/web/src/components/duplicates/duplicateGroupReviewFocus.ts`](../apps/web/src/components/duplicates/duplicateGroupReviewFocus.ts)
- [`apps/web/src/components/duplicates/duplicateGroupReviewHelpers.ts`](../apps/web/src/components/duplicates/duplicateGroupReviewHelpers.ts)

### Primary UI Responsibilities

The new page should:

- iterate provisional groups, not candidate pairs
- support two display modes:
  - grid
  - focus/full-viewport
- preserve one shared underlying working resolution state across both modes
- show historical hint counts for each asset
- allow explicit classification of every asset as:
  - keeper
  - duplicate
  - not in this group
- surface `resolved` and `needs rereview` clearly
- support manual reopen for resolved groups

### Suggested Route

- `/duplicates/groups`

### Queue Model

The page should behave like a queue of provisional groups, similar in spirit to current pair review but group-centered.

## Phase 8: Frontend Routing

### Files To Update

- [`apps/web/src/main.tsx`](../apps/web/src/main.tsx)

### Changes

Add:

- route for `/duplicates/groups`
- likely keep `/duplicates` redirecting to the new preferred workflow or preserve redirect to `/duplicates/review` depending on rollout choice

### Recommendation

For initial rollout:

- keep `/duplicates/review` as-is
- add `/duplicates/groups`
- keep `/duplicates` pointing to `/duplicates/review` until the new screen is ready and stable

Later, if desired, switch `/duplicates` to the group UI.

## Phase 9: Main App Integration

### Files To Update

- [`apps/web/src/App.tsx`](../apps/web/src/App.tsx)
- possibly existing duplicate-related helper files in:
  - [`apps/web/src/components/duplicates/duplicateResolutionVisibility.ts`](../apps/web/src/components/duplicates/duplicateResolutionVisibility.ts)

### Goal

Ensure the new group UI integrates cleanly with existing Library duplicate behavior.

### Requirements

- after group resolution, Library duplicate visibility should refresh
- `Keeper` / `Duplicate` badges should follow the authoritative group result
- reopening a group should clear or downgrade its final duplicate visibility as appropriate until re-resolved

### Existing Useful Infrastructure

There is already duplicate visibility refresh support in:

- [`apps/web/src/components/duplicates/duplicateVisibilityRefresh.ts`](../apps/web/src/components/duplicates/duplicateVisibilityRefresh.ts)
- [`apps/web/src/App.tsx`](../apps/web/src/App.tsx)

That infrastructure should be reused rather than reinvented.

## Phase 10: Existing Pair Review Coexistence

### Files To Update

- [`apps/web/src/components/duplicates/DuplicateReviewPage.tsx`](../apps/web/src/components/duplicates/DuplicateReviewPage.tsx)

### Goal

Keep pair review available without making it the final authority over group resolution.

### Recommended Behavior

The pair-review page should remain:

- available
- useful for low-level cleanup
- able to feed historical hints and candidate connectivity

But it should not silently override group resolution once the new group UI has resolved a set.

This likely requires small guardrails or at least clear semantics in the service layer.

## Phase 11: Re-review Detection

### Files To Update

- [`apps/api/src/services/duplicateGroupService.ts`](../apps/api/src/services/duplicateGroupService.ts)
- [`apps/api/src/services/duplicateCandidatePairService.ts`](../apps/api/src/services/duplicateCandidatePairService.ts)

### Goal

Detect when a previously resolved group should move into `needs rereview`.

### Required Behavior

When new candidate evidence connects an asset to a previously resolved duplicate group:

- do not silently merge it into the resolved group
- mark the relevant group as needing re-review
- expose that state in the new group UI list/detail API

### Important Design Choice

This should happen at the group-derivation layer, not just as a frontend guess.

## Phase 12: Documentation Update

### Files To Update

- [`Docs/DUPLICATE_UI.md`](./DUPLICATE_UI.md)
- keep product spec:
  - [`Docs/DUPLICATE_GROUP_UI_SPEC.md`](./DUPLICATE_GROUP_UI_SPEC.md)

### Documentation Tasks

After implementation, update docs to reflect:

- the new `/duplicates/groups` route
- difference between pair review and group review
- meaning of `Not In This Group`
- how historical counts are used
- how re-review works

## Suggested Delivery Order

### Slice 1

- shared types
- backend provisional-group listing
- new frontend route with read-only provisional group view

### Slice 2

- group resolution persistence
- one-keeper / duplicate / not-in-group editing
- save resolution

### Slice 3

- focus mode
- reopen group
- needs-rereview state

### Slice 4

- historical count hints refinement
- Library refresh and polish

## Major Risks / Open Implementation Notes

### 1. Historical Keeper Counts

This is the hardest part to make perfectly accurate for legacy data because existing pair-review persistence is not fully directional in the stored outcome model.

Implementation should explicitly choose whether to:

- accept best-effort historical counts for old data
- or add richer per-pair directional persistence going forward

### 2. Candidate Group Derivation Complexity

Connected candidate groups can become large and messy.

The initial implementation should:

- avoid trying to be globally perfect
- focus on coherent provisional groups
- expose rereview instead of trying to silently stabilize everything

### 3. Coexistence With Pair Review

The backend must avoid a situation where later pair-review actions accidentally erase or contradict an authoritative group resolution without signaling rereview.

## Recommended First Implementation Scope

For the first actual coding pass, implement:

- `/duplicates/groups`
- provisional group listing and detail
- group resolution with one keeper + duplicates + not-in-group
- grid and focus modes on one route
- Library refresh after group resolution
- best-effort historical counts

Defer if needed:

- perfect keeper-direction history reconstruction for old data
- extensive rereview automation polish
- pair-review reconciliation edge-case tooling

## Summary

The current Tedography codebase already contains most of the lower-level pieces needed for this feature:

- duplicate candidate pairs
- confirmed duplicate group derivation
- canonical asset selection
- duplicate visibility in Library

The missing layer is a new authoritative, group-oriented review workflow.

This plan adds that layer with the smallest coherent set of backend and frontend changes while preserving the current pair-review UI and reusing the existing duplicate data structures wherever practical.
