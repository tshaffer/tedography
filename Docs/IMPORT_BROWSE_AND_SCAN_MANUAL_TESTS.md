# Import Browse, Scan, and Register Manual Tests

This guide covers manual API testing for the v1 import flow:
- `GET /api/import/storage-roots`
- `GET /api/import/browse`
- `POST /api/import/scan`
- `POST /api/import/register`

## 1. Configure Environment

Set `TEDOGRAPHY_STORAGE_ROOTS` in `apps/api/.env`.

Example:

```env
TEDOGRAPHY_STORAGE_ROOTS=shmedia|ShMedia|/Volumes/ShMedia;shafferoto|Shafferoto Backup|/Volumes/SHAFFEROTO
```

Format:

```text
id|label|absolutePath;id|label|absolutePath
```

Validation expectations:
- `id`, `label`, and `absolutePath` are required per entry
- `absolutePath` must be absolute
- `id` must be unique
- malformed values should fail API startup

## 2. Start Backend

From repo root:

```bash
pnpm --filter @tedography/api dev
```

Default base URL:

```text
http://localhost:4000
```

Use a small test folder first (for example a folder with 3-10 files) to make responses easy to inspect.

## 3. Test `GET /api/import/storage-roots`

```bash
curl http://localhost:4000/api/import/storage-roots
```

Expected:
- HTTP 200
- each configured root appears
- `isAvailable` reflects whether the path currently exists

Example response:

```json
{
  "storageRoots": [
    { "id": "shmedia", "label": "ShMedia", "isAvailable": true },
    { "id": "shafferoto", "label": "Shafferoto Backup", "isAvailable": false }
  ]
}
```

## 4. Test `GET /api/import/browse`

### 4.1 Browse root

```bash
curl "http://localhost:4000/api/import/browse?rootId=shmedia"
```

Verify:
- `currentRelativePath` is `""`
- `parentRelativePath` is `null`
- directories and files are listed

### 4.2 Browse a subdirectory

Example relative path: `Australia 2025`

```bash
curl "http://localhost:4000/api/import/browse?rootId=shmedia&relativePath=Australia%202025"
```

Verify:
- `currentRelativePath` is `Australia 2025`
- `parentRelativePath` is correct
- file entries include `extension`, `mediaType`, and `isSupportedMedia`

### 4.3 Browse error cases

Missing rootId:

```bash
curl "http://localhost:4000/api/import/browse"
```

Unknown root:

```bash
curl "http://localhost:4000/api/import/browse?rootId=missing"
```

Traversal:

```bash
curl "http://localhost:4000/api/import/browse?rootId=shmedia&relativePath=../../"
```

Expected statuses:
- 400 for invalid input
- 404 for missing root/path
- 409 for unavailable root

## 5. Test `POST /api/import/scan`

### 5.1 Non-recursive scan

```bash
curl -X POST http://localhost:4000/api/import/scan \
  -H "Content-Type: application/json" \
  -d '{
    "rootId": "shmedia",
    "relativePath": "Australia 2025",
    "recursive": false
  }'
```

### 5.2 Recursive scan

```bash
curl -X POST http://localhost:4000/api/import/scan \
  -H "Content-Type: application/json" \
  -d '{
    "rootId": "shmedia",
    "relativePath": "Australia 2025",
    "recursive": true
  }'
```

Verify:
- summary totals are coherent
- statuses follow precedence:
  1. `Unsupported`
  2. `AlreadyImportedByPath`
  3. `DuplicateByContentHash`
  4. `Importable`
- supported files include `contentHash`
- metadata fields are present when available (`captureDateTime`, `width`, `height`)

## 6. Test `POST /api/import/register`

This endpoint registers existing files by reference only. No file copying/moving is performed.

### 6.1 Register selected files

Use relative paths returned from browse/scan.

```bash
curl -X POST http://localhost:4000/api/import/register \
  -H "Content-Type: application/json" \
  -d '{
    "rootId": "shmedia",
    "files": [
      { "relativePath": "Australia 2025/IMG_0001.JPG" },
      { "relativePath": "Australia 2025/IMG_0002.JPG" }
    ]
  }'
```

Expected response shape:

```json
{
  "importedCount": 2,
  "skippedAlreadyImportedByPathCount": 0,
  "skippedDuplicateContentCount": 0,
  "unsupportedCount": 0,
  "missingCount": 0,
  "errorCount": 0,
  "results": [
    {
      "relativePath": "Australia 2025/IMG_0001.JPG",
      "status": "Imported",
      "asset": {
        "id": "...",
        "filename": "IMG_0001.JPG",
        "relativePath": "Australia 2025/IMG_0001.JPG"
      }
    }
  ]
}
```

Verify per-file statuses:
- `Imported`
- `AlreadyImportedByPath`
- `DuplicateByContentHash`
- `Unsupported`
- `Missing`
- `Error`

## 7. Verify MongoDB After Register

### 7.1 Count before and after

In `mongosh`:

```javascript
use tedography

db.mediaAssets.countDocuments()
```

Run once before register and once after register.

### 7.2 Verify stored fields

```javascript
db.mediaAssets.find(
  { storageRootId: "shmedia", archivePath: "Australia 2025/IMG_0001.JPG" },
  {
    _id: 0,
    id: 1,
    filename: 1,
    storageRootId: 1,
    archivePath: 1,
    fileSizeBytes: 1,
    contentHash: 1,
    importedAt: 1,
    captureDateTime: 1,
    width: 1,
    height: 1,
    photoState: 1
  }
)
```

Verify:
- `storageRootId` and `archivePath` are set
- `contentHash` exists for supported files
- `photoState` defaults to `Unreviewed`
- `width`/`height`/`captureDateTime` are populated when available

## 8. Duplicate Guardrail Tests

### 8.1 Re-register same path(s)

Run the same `POST /api/import/register` again.

Expected:
- no new assets created for same path
- files return `AlreadyImportedByPath`
- `skippedAlreadyImportedByPathCount` increases

### 8.2 Content duplicate at a different path

Choose a file duplicated under a different relative path in the same or another folder under the same root.

Register both paths; for the later duplicate path expect:
- status `DuplicateByContentHash`
- no new asset inserted for that duplicate path

Re-run scan afterward to confirm duplicate signaling is reflected there too.

## 9. Error Cases to Exercise

Invalid body:

```bash
curl -X POST http://localhost:4000/api/import/register \
  -H "Content-Type: application/json" \
  -d '{}'
```

Invalid file item:

```bash
curl -X POST http://localhost:4000/api/import/register \
  -H "Content-Type: application/json" \
  -d '{"rootId":"shmedia","files":[{}]}'
```

Missing file:

```bash
curl -X POST http://localhost:4000/api/import/register \
  -H "Content-Type: application/json" \
  -d '{"rootId":"shmedia","files":[{"relativePath":"Australia 2025/DOES_NOT_EXIST.JPG"}]}'
```

Traversal attempt:

```bash
curl -X POST http://localhost:4000/api/import/register \
  -H "Content-Type: application/json" \
  -d '{"rootId":"shmedia","files":[{"relativePath":"../../etc/passwd"}]}'
```

Expected:
- request-level validation issues: HTTP 400
- per-file runtime issues in valid request: HTTP 200 with file-level `Missing`/`Error`
- unavailable root: HTTP 409
- unknown root: HTTP 404

## 10. End State for This Phase

A complete manual flow should now work:
1. Browse roots
2. Browse target directory
3. Scan target
4. Register selected files
5. Verify MongoDB records
6. Re-run scan/register and confirm duplicate guardrails

## 11. Frontend Flow Check

Use the web app at `http://localhost:3000`.

1. Click `Import` in the top controls.
2. In the dialog, choose a storage root.
3. Browse directories and click into the target folder.
4. Click `Use Current Folder`.
5. Click `Scan Selected Folder`.
6. Confirm scan summary and file statuses appear.
7. Confirm `Importable` files are preselected.
8. Optionally adjust selection, then click `Import Selected`.
9. Confirm register summary appears in the dialog.
10. Confirm grid/assets refresh after successful import (`Imported > 0`).

Frontend error checks:
- unavailable root should show a clear error message in the dialog
- scan failure should show scan error text
- register failure should show register error text
