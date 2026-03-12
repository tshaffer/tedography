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
