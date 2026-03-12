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
