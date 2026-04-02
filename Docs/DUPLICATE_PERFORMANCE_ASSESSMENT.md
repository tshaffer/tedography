# Duplicate Performance Assessment

## Scope

This is a repo-based assessment of how much performance Tedography would likely gain if duplicate-related concept/code were removed.

It is **not** a runtime benchmark. The conclusions below are based on:

- backend request paths and query patterns
- frontend bootstrap and render paths
- caching behavior visible in the code
- where duplicate logic sits on normal browsing hot paths vs duplicate-only screens

## Earlier High-Level Answer

For normal non-duplicate use, the improvement would probably be **modest, not dramatic**.

Today the main app still does duplicate work on the normal bootstrap path:

- it makes an extra request to load duplicate visibility on startup in [apps/web/src/App.tsx](/Users/tedshaffer/Documents/Projects/tedography/apps/web/src/App.tsx#L3645)
- it applies duplicate suppression filtering over visible assets in [apps/web/src/App.tsx](/Users/tedshaffer/Documents/Projects/tedography/apps/web/src/App.tsx#L3963)
- it looks up duplicate state for selected assets and tiles in a few render paths in [apps/web/src/App.tsx](/Users/tedshaffer/Documents/Projects/tedography/apps/web/src/App.tsx#L4235)

On the backend, that startup request is not free. `listDuplicateGroups()` ultimately derives groups from candidate pairs and confirmed resolutions in [apps/api/src/services/duplicateGroupService.ts](/Users/tedshaffer/Documents/Projects/tedography/apps/api/src/services/duplicateGroupService.ts#L1202). That is materially more expensive than a simple indexed read, especially as duplicate-pair volume grows.

Practical impact by area:

- Server calls: removing duplicates would remove at least one normal-app bootstrap call and slightly reduce network chatter.
- Server processing: normal `/api/assets` reads would not speed up much, but duplicate-group derivation and duplicate review endpoints would disappear.
- Frontend processing: one bootstrap fetch, one suppression map, one filtering pass, and duplicate badge/detail lookups would disappear.

Initial estimate:

- normal app startup/load: roughly 5-15% improvement, more if duplicate-group derivation is slow for the dataset
- normal interaction after bootstrap: probably low single digits
- duplicate-specific pages/workflows: potentially much faster, because the feature would be gone entirely

## Concrete Repo-Based Assessment

### Bottom Line

Removing duplicates from Tedography would likely produce:

- a **small-to-moderate improvement** for everyday Library/Search/Review usage
- a **large improvement** for duplicate-specific screens and duplicate-review maintenance flows
- a **large simplification benefit** in architecture and code complexity, which may matter as much as raw speed

The duplicate system is **not the dominant cost** of normal browsing. Large asset payloads, image rendering, and general asset filtering are still the larger structural costs. But duplicate logic is on the normal bootstrap path, so it is not free.

### Where Duplicate Work Is On The Normal Hot Path

#### 1. Frontend startup always loads duplicate visibility

The main app calls `loadDuplicateResolutionVisibility()` during bootstrap in [apps/web/src/App.tsx](/Users/tedshaffer/Documents/Projects/tedography/apps/web/src/App.tsx#L3681). That function calls `listDuplicateGroups()` in [apps/web/src/App.tsx](/Users/tedshaffer/Documents/Projects/tedography/apps/web/src/App.tsx#L3645), which requests:

- `/api/duplicate-candidate-pairs/groups`

from [apps/web/src/api/duplicateCandidatePairApi.ts](/Users/tedshaffer/Documents/Projects/tedography/apps/web/src/api/duplicateCandidatePairApi.ts#L115).

That means duplicate-related backend work happens even when the user is just opening the app to browse photos.

#### 2. Duplicate state is part of normal asset filtering

After photo-state filtering, the app applies duplicate suppression in [apps/web/src/App.tsx](/Users/tedshaffer/Documents/Projects/tedography/apps/web/src/App.tsx#L3963) using:

- `filterAssetsByDuplicateSuppression()` from [apps/web/src/components/duplicates/duplicateResolutionVisibility.ts](/Users/tedshaffer/Documents/Projects/tedography/apps/web/src/components/duplicates/duplicateResolutionVisibility.ts#L35)

This is not algorithmically scary by itself. It is essentially one extra pass over the visible asset list with `Map` lookups. But it is still repeated work in a central render path.

#### 3. Duplicate state is also used in normal detail/tile rendering

The selected asset and visible tiles look up duplicate state in:

- [apps/web/src/App.tsx](/Users/tedshaffer/Documents/Projects/tedography/apps/web/src/App.tsx#L4235)
- [apps/web/src/App.tsx](/Users/tedshaffer/Documents/Projects/tedography/apps/web/src/App.tsx#L7715)
- [apps/web/src/App.tsx](/Users/tedshaffer/Documents/Projects/tedography/apps/web/src/App.tsx#L7745)
- [apps/web/src/App.tsx](/Users/tedshaffer/Documents/Projects/tedography/apps/web/src/App.tsx#L7766)

Again, these lookups are individually cheap, but they keep duplicate state coupled to ordinary browsing UI.

### Where The Backend Cost Actually Lives

#### 1. The normal duplicate visibility call is more expensive than it looks

The frontend startup call hits `listDerivedDuplicateGroups()` in [apps/api/src/services/duplicateGroupService.ts](/Users/tedshaffer/Documents/Projects/tedography/apps/api/src/services/duplicateGroupService.ts#L1202).

That function does all of the following:

- loads confirmed duplicate pairs via `listConfirmedDuplicatePairs()` in [apps/api/src/services/duplicateGroupService.ts](/Users/tedshaffer/Documents/Projects/tedography/apps/api/src/services/duplicateGroupService.ts#L679) and [apps/api/src/repositories/duplicateCandidatePairRepository.ts](/Users/tedshaffer/Documents/Projects/tedography/apps/api/src/repositories/duplicateCandidatePairRepository.ts#L303)
- derives groups in memory with `deriveDuplicateGroups()` in [apps/api/src/services/duplicateGroupService.ts](/Users/tedshaffer/Documents/Projects/tedography/apps/api/src/services/duplicateGroupService.ts#L319)
- builds each group item with `buildDuplicateGroupListItem()` in [apps/api/src/services/duplicateGroupService.ts](/Users/tedshaffer/Documents/Projects/tedography/apps/api/src/services/duplicateGroupService.ts#L647)

`buildDuplicateGroupListItem()` is especially important because for each group it does:

- `findByIdsForDuplicateReview(group.assetIds)`
- `findDuplicateGroupResolutionByKey(groupKey)`

So the normal duplicate-visibility request is not just a single bulk query. It is:

- one query to load all confirmed duplicate pairs
- in-memory graph/group derivation
- then per-group asset/resolution reads

That scales much worse than a simple precomputed visibility table.

#### 2. Derived duplicate groups do not appear to be cached

There is explicit caching for:

- provisional duplicate groups: [apps/api/src/services/duplicateGroupService.ts](/Users/tedshaffer/Documents/Projects/tedography/apps/api/src/services/duplicateGroupService.ts#L86)
- confirmed duplicate resolutions: [apps/api/src/services/duplicateGroupService.ts](/Users/tedshaffer/Documents/Projects/tedography/apps/api/src/services/duplicateGroupService.ts#L88)
- provisional duplicate group detail: [apps/api/src/services/duplicateGroupService.ts](/Users/tedshaffer/Documents/Projects/tedography/apps/api/src/services/duplicateGroupService.ts#L90)

But `loadDerivedGroups()` in [apps/api/src/services/duplicateGroupService.ts](/Users/tedshaffer/Documents/Projects/tedography/apps/api/src/services/duplicateGroupService.ts#L679) is rebuilt on demand from confirmed pairs each time `listDerivedDuplicateGroups()` is requested.

That matters because the normal app bootstrap path uses derived groups, not the provisional-group cache path.

#### 3. Duplicate-only flows are much heavier than normal browsing

Duplicate endpoints also support:

- listing candidate pairs and counts in [apps/api/src/routes/duplicateCandidatePairRoutes.ts](/Users/tedshaffer/Documents/Projects/tedography/apps/api/src/routes/duplicateCandidatePairRoutes.ts#L185)
- provisional duplicate groups in [apps/api/src/routes/duplicateCandidatePairRoutes.ts](/Users/tedshaffer/Documents/Projects/tedography/apps/api/src/routes/duplicateCandidatePairRoutes.ts#L354)
- provisional group detail in [apps/api/src/services/duplicateGroupService.ts](/Users/tedshaffer/Documents/Projects/tedography/apps/api/src/services/duplicateGroupService.ts#L1277)

These flows are substantially more expensive than normal asset browsing and would benefit the most from removal.

### What Does Not Get Much Faster

Removing duplicates would **not** materially speed up the main asset read path itself:

- `/api/assets` is still served by `getAssetPageForLibrary()` in [apps/api/src/server.ts](/Users/tedshaffer/Documents/Projects/tedography/apps/api/src/server.ts#L40) and [apps/api/src/repositories/assetRepository.ts](/Users/tedshaffer/Documents/Projects/tedography/apps/api/src/repositories/assetRepository.ts#L66)
- the frontend still fetches asset pages, parses them, stores them, filters them, and renders them in [apps/web/src/App.tsx](/Users/tedshaffer/Documents/Projects/tedography/apps/web/src/App.tsx#L3484)

So if the app feels slow because:

- the asset list is large
- many images/thumbnails are rendering
- React is processing a large visible list

then removing duplicates will help only indirectly.

### Estimated Impact By Area

#### Normal startup / bootstrap

Expected improvement: **small to moderate**

Why:

- one less startup fetch
- no duplicate visibility map construction
- no duplicate suppression step in the common filtered-assets pipeline
- no backend derived-group rebuild for startup visibility

This is where the most meaningful non-duplicate benefit would appear.

#### Normal browsing after bootstrap

Expected improvement: **small**

Why:

- duplicate filtering and badge lookups are cheap relative to the rest of browsing
- the heavy duplicate derivation is mostly paid when duplicate visibility is loaded, not on every render

#### Duplicate review screens and duplicate maintenance

Expected improvement: **large**

Why:

- these flows are duplicate-heavy by definition
- they depend on candidate-pair queries, grouping, resolution logic, and extra UI state

### Rough Performance Estimate

Based on the current structure, a reasonable estimate is:

- normal app startup/load: **about 5-15% faster**
- normal interaction after bootstrap: **low single-digit improvement**
- duplicate-specific screens: **materially faster or entirely eliminated**

If the duplicate candidate/resolution dataset is large, the startup improvement could exceed that range. If the dataset is small, it could be below it.

### Architectural Simplification Benefit

Even if the runtime win is only moderate, deleting duplicates would remove a lot of moving parts:

- duplicate API routes
- duplicate candidate/review repositories and services
- duplicate visibility bootstrap logic
- duplicate suppression state in the main browsing UI
- duplicate-specific caches and invalidation paths

That simplification would reduce maintenance cost and lower the chance of duplicate-specific regressions affecting normal browsing.

## Recommendation

If the goal is purely performance for normal browsing, **removing duplicates is probably not the highest-leverage change**.

A better sequence would likely be:

1. remove duplicate visibility from the normal bootstrap path, or defer it until needed
2. if duplicates must stay, cache or precompute derived duplicate visibility instead of rebuilding groups on demand
3. only remove the entire duplicate system if you no longer need the workflow or if codebase simplification is itself a priority

## Best Next Optimization If Duplicates Stay

The highest-leverage improvement visible from this repo is:

- **stop calling `listDuplicateGroups()` during normal app bootstrap**

Instead:

- load it lazily only when the user enables duplicate-related UI
- or store precomputed suppression/role metadata directly with assets or in a lightweight lookup collection

That would likely capture much of the normal-use performance benefit without deleting the whole feature.

