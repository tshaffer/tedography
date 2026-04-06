# Album Tree Count Investigation

This document describes how the album tree count labels such as `08-2002 to 12-2002 (143)` are computed in the web app, how they are initially populated, how they change over time, and why some album rows can show `0` even when the album is not actually empty.

## Short answer

The album count labels are not loaded from the album tree API and they are not stored on album nodes.

They are computed entirely on the client from the current in-memory `assets` array:

- every loaded asset contributes `+1` to each album id listed in `asset.albumIds`
- any album id not present in the currently loaded `assets` array displays as `0`

This means the counts can be wrong or incomplete when:

- only part of the assets list has been loaded so far
- the cached asset bootstrap only contains a subset of assets
- the asset bootstrap scope is limited to checked albums instead of all assets

The screenshot strongly suggests the third case is active: one album is checked, and the app is likely loading only assets from checked albums, which makes many other album rows display `0`.

## Where the label is rendered

The album tree row label is built in `renderAlbumTreeRows()` in [App.tsx](/Users/tedshaffer/Documents/Projects/tedography/apps/web/src/App.tsx#L6556).

For album nodes, the label is:

```ts
`${node.label} (${albumAssetCounts.get(node.id) ?? 0})`
```

Source: [App.tsx](/Users/tedshaffer/Documents/Projects/tedography/apps/web/src/App.tsx#L6569)

Important implication:

- if `albumAssetCounts` has no entry for that album id, the UI explicitly shows `0`

## How the counts are computed

The counts come from this memoized map:

Source: [App.tsx](/Users/tedshaffer/Documents/Projects/tedography/apps/web/src/App.tsx#L3994)

Algorithm:

1. Start with an empty `Map<string, number>`.
2. Loop over every asset in the current `assets` state array.
3. For each asset, loop over `asset.albumIds ?? []`.
4. Increment the count for each album id seen.

This means:

- counts are derived only from `assets`
- counts are not fetched from `albumTreeNodes`
- counts are not precomputed on the server
- group rows do not display counts at all

## Where the album tree data comes from

Album tree nodes are loaded separately from assets using `listAlbumTreeNodes()`.

Source: [App.tsx](/Users/tedshaffer/Documents/Projects/tedography/apps/web/src/App.tsx#L3721)

That API only provides the album/group structure. It does not populate counts.

So there are two separate client states:

- `albumTreeNodes`
- `assets`

The rendered count is the join of those two states performed in the browser.

## How the `assets` array is initially populated

The app first tries to bootstrap from in-memory/session cache.

Relevant code:

- cached asset bootstrap reader: [App.tsx](/Users/tedshaffer/Documents/Projects/tedography/apps/web/src/App.tsx#L281)
- asset state initialization: [App.tsx](/Users/tedshaffer/Documents/Projects/tedography/apps/web/src/App.tsx#L2832)
- mount-time bootstrap effect: [App.tsx](/Users/tedshaffer/Documents/Projects/tedography/apps/web/src/App.tsx#L3744)

At startup:

1. `assets` may be initialized from `appBootstrapCache.assets` or session storage.
2. If cached assets exist, the app immediately sets `assets` from cache.
3. It then starts a background `loadAssets()` refresh.
4. If no cache exists, it calls `loadAssets()` with loading state visible.

Important implication:

- album counts can initially reflect stale or partial cached asset data before the live fetch completes

## How `loadAssets()` fills the array

The asset bootstrap is paged.

Constants:

- `initialAssetsPageSize = 1000` at [App.tsx](/Users/tedshaffer/Documents/Projects/tedography/apps/web/src/App.tsx#L166)
- `backgroundAssetsPageSize = 4000` at [App.tsx](/Users/tedshaffer/Documents/Projects/tedography/apps/web/src/App.tsx#L167)

Request path builder:

- [App.tsx](/Users/tedshaffer/Documents/Projects/tedography/apps/web/src/App.tsx#L169)

Main loader:

- [App.tsx](/Users/tedshaffer/Documents/Projects/tedography/apps/web/src/App.tsx#L3537)

Behavior:

1. Fetch page 1 from `/api/assets` with `offset=0` and `limit=1000`.
2. Set `assets` to either:
   - the first live page, or
   - a larger cached list for the same scope, if `preserveCachedFirstPage` is not disabled
3. If the server says `hasMore`, fetch more pages in the background in chunks of 4000.
4. After each background page, append the new items and call `setAssets(combined)`.

Important implication:

- counts can change upward over time as more asset pages are appended
- until all pages are loaded, counts are based on a partial asset set

## Server-side asset paging

The web client gets assets from `/api/assets`.

Source: [server.ts](/Users/tedshaffer/Documents/Projects/tedography/apps/api/src/server.ts#L37)

That route calls `getAssetPageForLibrary()`:

- [assetRepository.ts](/Users/tedshaffer/Documents/Projects/tedography/apps/api/src/repositories/assetRepository.ts#L72)

Server behavior:

- defaults to `limit=1000`
- sorts by `id`
- supports `offset` and `albumIds`
- if `albumIds` are provided, the query becomes:

```ts
{ albumIds: { $in: albumIds } }
```

Source: [assetRepository.ts](/Users/tedshaffer/Documents/Projects/tedography/apps/api/src/repositories/assetRepository.ts#L84)

Important implication:

- the client may deliberately ask the server for only assets belonging to checked albums

## The most important behavior: startup scope can be album-limited

The app computes a `preferredStartupAssetsScope`.

Source: [App.tsx](/Users/tedshaffer/Documents/Projects/tedography/apps/web/src/App.tsx#L3526)

If all of the following are true:

- primary area is `Library`
- browse mode is `Albums`
- `checkedAlbumIds.length > 0`

then the preferred startup scope becomes:

- `{ kind: 'albums', albumIds: checkedAlbumIds }`

Otherwise the scope is:

- `{ kind: 'all' }`

This scoped value is then passed into `loadAssets()`.

## Why many albums can show `0`

Because `albumAssetCounts` is computed only from the current `assets` array, and `assets` may be scoped to checked albums.

In that case:

- assets from checked albums are loaded
- assets outside checked albums are absent from `assets`
- their album ids never appear in the counting loop
- those album rows render `0`

This is not just a temporary loading issue. It can be a stable consequence of the current scope.

Given the screenshot:

- the app is in `Library` + `Albums`
- at least one album is checked
- several sibling albums show `0`

That strongly matches the current implementation: counts are being computed from an album-scoped asset subset, not from the entire library.

## When counts update

Counts update whenever `assets` changes, because `albumAssetCounts` is a `useMemo` dependent on `[assets]`.

Source: [App.tsx](/Users/tedshaffer/Documents/Projects/tedography/apps/web/src/App.tsx#L3994)

That means counts are recalculated when:

- initial cached assets are applied
- the first live asset page arrives
- background asset pages are appended
- an asset reload occurs after import or maintenance
- album membership changes update asset state locally
- photo state / people updates modify entries in `assets`

## Do the values ever reset?

There is no separate count state to reset.

The displayed values are always recomputed from the current `assets` array.

So counts effectively “reset” whenever `assets` is replaced with a different dataset or scope.

Examples:

- startup cache may set one version of `assets`
- live fetch may replace it with a different first page
- switching scope from `all` to `albums:<checked ids>` reloads a narrower asset set
- reloading after import or maintenance can replace the array again

Relevant scope-change effect:

- [App.tsx](/Users/tedshaffer/Documents/Projects/tedography/apps/web/src/App.tsx#L3793)

That effect reloads assets when the preferred startup scope changes away from the currently cached album scope.

## Are counts ever explicitly cleared to zero?

No explicit “reset count map to zero” exists.

What happens instead is:

- `albumAssetCounts` starts as an empty `Map`
- any album missing from the map renders as `0`

So the UI shows `0` because of missing count entries, not because a stored count value was explicitly set to zero.

## Local updates that can affect counts without a full reload

There are two album-membership paths to note:

### Remove from focused album

When removing selected assets from the focused album, the app immediately patches local `assets` state by removing that album id from affected assets.

Source: [App.tsx](/Users/tedshaffer/Documents/Projects/tedography/apps/web/src/App.tsx#L6049)

That changes the computed counts immediately, even before the later refresh finishes.

### Move to another album

When moving assets between albums, the app performs:

- add to destination
- optional remove from source
- then reloads assets

Source: [App.tsx](/Users/tedshaffer/Documents/Projects/tedography/apps/web/src/App.tsx#L6080)

So in this flow, the count changes mainly come from the subsequent `loadAssets()` refresh.

## Cached persistence behavior

Assets are written back to session storage whenever `assets.length > 0`.

Source: [App.tsx](/Users/tedshaffer/Documents/Projects/tedography/apps/web/src/App.tsx#L3510)

Album tree nodes are also cached separately:

- [App.tsx](/Users/tedshaffer/Documents/Projects/tedography/apps/web/src/App.tsx#L3520)

Because counts depend on cached `assets`, stale counts can reappear briefly on the next load until the live refresh completes.

## Conclusion

The displayed album counts are client-derived counts over the currently loaded asset subset, not authoritative album totals.

That means the current implementation has two built-in failure modes for accuracy:

- partial paging: counts are incomplete until all pages for the current scope finish loading
- scope restriction: in `Library` + `Albums` with checked albums, the client may load only assets from checked albums, causing unrelated albums to display `0`

The screenshot is most consistent with scope restriction rather than simple delayed loading. The checked album has a non-zero count, while many other albums show `0` because their assets are not present in the current `assets` bootstrap scope.
