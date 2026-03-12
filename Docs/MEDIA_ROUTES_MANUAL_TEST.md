# Media Routes Manual Test

## Verify cache headers

1. Start the API server.
2. Pick an existing asset id from `GET /api/assets`.
3. Check thumbnail headers:

```bash
curl -I http://localhost:4000/api/media/thumbnail/<assetId>
```

Expected header:

```text
Cache-Control: public, max-age=31536000, immutable
```

4. Check display headers:

```bash
curl -I http://localhost:4000/api/media/display/<assetId>
```

Expected header:

```text
Cache-Control: public, max-age=31536000, immutable
```

5. Check original headers:

```bash
curl -I http://localhost:4000/api/media/original/<assetId>
```

Expected header:

```text
Cache-Control: public, max-age=86400
```

## Basic behavior checks

1. Request media with a valid id and verify a `200` response.
2. Request media with a non-existent asset id and verify `404` is unchanged.
3. Request media where the backing file is missing and verify `404` is unchanged.

## Testing Loupe Prefetching

1. Open the grid and select an asset.
2. Enter loupe/immersive mode.
3. Open browser DevTools and go to the Network tab.
4. Keep the media filter focused on `/api/media/display/`.
5. Verify the active image `N` loads first.
6. After image `N` load succeeds, verify background requests are made for image `N+1` first and image `N-1` second (when those neighbors exist).
7. Navigate quickly with left/right keys across several images and verify stale older loads do not trigger obviously wrong neighbor prefetches.
8. Navigate to next/previous using arrow keys or viewer controls and verify the viewed image is already cached (no extra network fetch for that same display URL).

## Testing Asset Filtering

1. Start with no filters selected and verify all assets are visible.
2. Under `Filters`, select one photo state (for example `Unreviewed`) and verify only that state remains.
3. Select multiple photo states and verify the result is a union within photo state.
4. Select one media type (`Photo` or `Video`) and verify only that media type remains.
5. Combine photo state + media type selections and verify AND behavior across categories.
6. If current focused asset is filtered out, verify focus/selection moves to a visible asset when available.
7. Apply filters that match nothing and verify the no-match message appears with a `Clear Filters` action.
8. Click `Clear Filters` and verify all assets return.
9. With no checkboxes selected in either group, verify this is treated as `show all` rather than `show none`.

## Testing Asset Quick Bar

1. Open an asset in normal review view and verify quick bar appears above focused asset details.
2. Verify quick bar shows: filename, position, state, type, dimensions, capture time, original format.
3. Open a HEIC-backed asset and verify original format is `heic` and display hint reflects conversion (for example `HEIC → JPG`).
4. Navigate next/previous and verify quick bar updates immediately with current position and metadata.
5. Apply filters and verify quick bar position reflects the filtered visible set.
6. Open immersive fullscreen and verify quick bar is hidden in immersive view.
7. Open survey mode and verify quick bar reflects the focused survey asset and compare-set position.

## Testing Filmstrip Navigation

1. Open the focused review/loupe section.
2. Verify filmstrip appears below the focused image panel.
3. Verify filmstrip thumbnails match the currently visible asset set.
4. Click a filmstrip thumbnail and verify focused asset updates.
5. Verify active filmstrip thumbnail highlight moves with selection.
6. Use keyboard left/right navigation and verify filmstrip highlight updates.
7. Verify active thumbnail auto-centers when navigating, with neighboring thumbnails visible on both sides when possible.
8. Click a distant thumbnail and verify loupe updates and the strip recenters to that item.
9. Manually scroll the filmstrip and verify the UI does not continuously fight that manual scroll.
10. Apply filters and verify filmstrip updates to only filtered assets.

## Testing Advance-After-Rating

1. Disable `Advance after rating`.
2. Set current asset to `Select`, `Pending`, and `Reject`; verify state changes and active asset stays on the same item.
3. Enable `Advance after rating`.
4. Set current asset to `Select`, `Pending`, and `Reject`; verify state changes and active asset advances to the next visible asset.
5. On the last visible asset, rate it and verify there is no wraparound.
6. Filter to `Unreviewed` only, enable advance-after-rating, and rate current asset so it leaves filter; verify focus advances to the next remaining visible item or clean no-match state.
7. Verify keyboard review shortcuts (S/P/R/U) also advance when the option is enabled.
8. Reload the page and verify `Advance after rating` persists using the previous toggle value.

## Testing Hide Reject

1. With `Hide Reject` OFF, verify rejected assets remain visible in grid, review context, and filmstrip.
2. Turn `Hide Reject` ON and verify rejected assets disappear from the current visible set.
3. If current active asset is rejected when turning ON, verify selection moves to next visible asset, otherwise previous, otherwise clears cleanly.
4. With `Hide Reject` ON, rate current asset to `Reject` and verify it disappears immediately and focus moves to next visible asset (or previous/none if needed).
5. Verify loupe navigation and filmstrip stay consistent with the same post-hide visible set.
6. Combine `Hide Reject` with existing PhotoState/MediaType filters and verify behavior remains coherent.
7. Force a no-visible-assets state and verify message appears with recovery actions (`Clear Filters` and `Show Rejects` when applicable).
8. Reload the app and verify `Hide Reject` preference persists.

## Testing Timeline Grouping

1. Turn `Group by Date` OFF and verify flat grid behavior remains.
2. Turn `Group by Date` ON and verify assets render under day headers.
3. Verify newer date groups appear first and assets within each group are in descending capture order.
4. Apply PhotoState/MediaType filters and verify grouping reflects only filtered visible assets.
5. Verify assets missing `captureDateTime` appear under `Unknown Date`.
6. Click an asset inside a grouped section and verify normal selection/loupe behavior works.
7. Verify filmstrip/loupe navigation uses the same visible ordered set while grouped view is enabled.
8. Reload the app and verify `Group by Date` preference persists.

## Testing Album Tree (Groups + Albums)

1. Create a `Group` node and a child `Album` node; verify tree renders hierarchy.
2. Expand/collapse group nodes and reload; verify expanded group ids persist.
3. Check one album and switch to `Checked Albums` mode; verify visible assets are scoped to that album.
4. Check two albums with overlapping assets and verify visible set is a deduplicated union.
5. Uncheck all albums in `Checked Albums` mode and verify the scoped empty message appears.
6. Click `All Photos` and verify full library returns (still subject to filters).
7. Select one or more assets and click `Add to Album`; verify album count and scoped view update.
8. Select an album node, remove selected assets via `Remove from Album`, and verify they leave that album but remain in library.
9. Delete an album and verify:
   - album node is removed,
   - assets remain,
   - removed album membership no longer appears on assets.
10. Attempt to delete a non-empty group and verify deletion is blocked with a clear error.
11. Reload and verify checked album ids persist; stale ids from deleted albums are ignored safely.

## Testing Asset Integrity Verification

1. Run:

```bash
pnpm --filter @tedography/api assets:verify
```

2. Verify summary includes counts for:
   - assets checked
   - missing original/display/thumbnail files
   - invalid original/display/thumbnail references
   - missing storage roots
   - file size mismatches
3. Verify sample problem lines include asset id, filename, category, and message.
4. Optional JSON output:

```bash
pnpm --filter @tedography/api assets:verify --json
```

5. Safe missing-thumbnail simulation (test copy only): temporarily rename one derived thumbnail file under `TEDOGRAPHY_DERIVED_ROOT/thumbnails`, run verify, then restore the file. Expect `MissingThumbnailFile`.
6. Safe missing-display simulation (test copy only): for a HEIC-backed asset, temporarily rename its derived display file under `TEDOGRAPHY_DERIVED_ROOT/display-jpegs`, run verify, then restore. Expect `MissingDisplayFile`.
7. Safe missing-original simulation (test copy only): temporarily rename an original file in a non-production test folder, run verify, then restore. Expect `MissingOriginalFile`.
8. Optional file size mismatch simulation (test copy only): replace a test original with a different-size file at the same path, run verify, then restore. Expect `FileSizeMismatch`.

## Testing Review vs Library Areas

1. Open app with no stored area preference and verify `Review` is the default.
2. In `Review`, verify default scope shows only `Unreviewed` + `Pending` assets.
3. In `Review`, verify `Select` assets are excluded unless additional logic explicitly includes them.
4. Switch to `Library` and verify default scope shows `Select` assets.
5. In `Library`, verify `Unreviewed`/`Pending` assets are excluded by default.
6. Switch between `Review` and `Library` and verify active asset stays if still visible, otherwise moves to a valid replacement or clears cleanly.
7. Verify `Review` area empty message appears when no assets are in `Unreviewed`/`Pending` scope.
8. Verify `Library` area empty message appears when no assets are in `Select` scope.
9. Verify true no-assets state still shows import-focused empty state.
10. Reload app and verify last selected area persists.

## Testing Area-Aware Toolbar Emphasis

1. Switch to `Review` and verify curation controls are emphasized:
   - `Survey`
   - `Advance after rating`
   - `Hide Reject`
2. In `Review`, verify album tree management controls are not dominant in the top row.
3. Switch to `Library` and verify browsing controls are emphasized:
   - `Import`
   - `Group by Date`
   - album tree management controls (`New Group`, `New Album`, `Rename Node`, `Delete Node`)
4. In `Library`, verify review toggles remain available but visually de-emphasized.
5. Verify selection-dependent actions (`Add to Album`, `Remove from Album`) still work in both areas.
6. Switch Review ↔ Library and verify toolbar groups update immediately without breaking active asset navigation.
7. Enter immersive fullscreen and verify the area-aware toolbar changes do not clutter fullscreen UI.

## Testing Library Timeline Mode

1. Switch to `Library` and verify default Library scope still shows only `Select` assets.
2. In `Library View`, switch between `Flat` and `Timeline`.
3. In `Timeline`, verify month sections render (for example `March 2026`) with per-section asset counts.
4. Verify month sections are ordered newest-first and assets within each month remain in descending chronological order.
5. In the timeline left panel, expand/collapse year groups and click a month; verify main content scrolls to that month section.
6. Apply PhotoState/MediaType/Hide Reject filters and verify timeline sections and counts reflect only filtered visible assets.
7. Click an asset in Timeline mode and verify focused asset, loupe, quick bar, and filmstrip continue to work normally.
8. Reload the app and verify `Library View` mode persists.
9. Verify assets without capture date appear under `Unknown Date`.

## Testing Library Albums Mode

1. Switch to `Library` and verify default scope remains `Select` assets.
2. Switch `Library View` to `Albums` and verify album tree is the primary navigator.
3. With no albums checked, verify scoped empty state appears: `Check one or more albums to browse their photos.`
4. Check one leaf album and verify only that album's assets are shown.
5. Check multiple leaf albums and verify visible assets become the union of checked albums.
6. Set `Album Results` to `Merged` and verify duplicates across albums are deduplicated.
7. Set `Album Results` to `Grouped by Album` and verify sections render per checked album.
8. In `Grouped by Album`, verify an asset can appear in multiple sections if it belongs to multiple checked albums.
9. Apply PhotoState/MediaType/Hide Reject filters and verify album-scoped results update correctly.
10. Click assets in Albums mode and verify loupe, quick bar, filmstrip, and keyboard navigation remain coherent.
11. Reload the app and verify `Library View` mode and `Album Results` presentation persist.
12. Reload and verify checked album ids / expanded groups still restore correctly.
