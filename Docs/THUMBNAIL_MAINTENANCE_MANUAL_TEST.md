# Thumbnail Maintenance Manual Test

## Prerequisites

1. Ensure `MONGODB_URI`, `TEDOGRAPHY_STORAGE_ROOTS`, and `TEDOGRAPHY_DERIVED_ROOT` are configured in `apps/api/.env`.
2. Ensure the API can connect to MongoDB.
3. Ensure the database contains photo assets (including at least one HEIC-backed asset if available).

## Verify mode

Run:

```bash
pnpm thumbnails:verify
```

Expected:
- summary line with `checked`, `present`, `missing`, `errors`
- optional sample list of missing thumbnails (up to 10)

Interpretation:
- `missing > 0` means those assets need `repair`
- `errors > 0` indicates per-asset resolution/generation failures to investigate

## Repair mode

1. Pick one asset content hash and remove its thumbnail file under:
   `TEDOGRAPHY_DERIVED_ROOT/thumbnails/<originalContentHash>.jpg`
2. Run:

```bash
pnpm thumbnails:repair
```

Expected:
- missing thumbnail is recreated
- summary includes `alreadyPresent`, `regenerated`, `skipped`, `referencesUpdated`, `errors`
- existing thumbnails are skipped, not regenerated

Filesystem check:

```bash
ls -l "<TEDOGRAPHY_DERIVED_ROOT>/thumbnails/<originalContentHash>.jpg"
```

## Rebuild mode

Run:

```bash
pnpm thumbnails:rebuild
```

Expected:
- all photo thumbnails are regenerated (force mode)
- summary includes `checked`, `regenerated`, `referencesUpdated`, `errors`

## HEIC-backed asset check

1. Find a HEIC-backed asset in Mongo (`originalFileFormat: "heic"`).
2. Confirm it has a display derivative path (`displayStorageType: "derived-root"`, `displayDerivedPath` set).
3. Run repair or rebuild.
4. Verify thumbnail file exists at:
   `TEDOGRAPHY_DERIVED_ROOT/thumbnails/<originalContentHash>.jpg`

Expected behavior:
- thumbnail generation uses the asset display image source path
- HEIC original is not modified

## MongoDB spot checks

For a repaired/rebuilt asset, verify fields:
- `thumbnailStorageType: "derived-root"`
- `thumbnailDerivedPath: "thumbnails/<originalContentHash>.jpg"`
- `thumbnailFileFormat: "jpg"`

Example query:

```javascript
db.mediaAssets.find(
  { mediaType: 'Photo' },
  {
    id: 1,
    filename: 1,
    originalContentHash: 1,
    thumbnailStorageType: 1,
    thumbnailDerivedPath: 1,
    thumbnailFileFormat: 1
  }
)
```
