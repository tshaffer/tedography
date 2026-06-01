# Edit Queue — Export & Import Workflow

The Edit Queue lets you export original photos to an external folder, edit them with any tool you choose, then import the edited results back into Tedography. Imported files inherit key metadata from their source (album memberships, keywords, location, capture date).

---

## Setup

Add the following to `apps/api/.env`:

```
TEDOGRAPHY_EDIT_PATH=/absolute/path/to/your/edit/folder
```

The folder does not need to exist — it is created automatically on first export.

**Important:** The edit path must be located within (or be the same as) one of your registered `TEDOGRAPHY_STORAGE_ROOTS`. Tedography registers the edit path as a virtual storage root named `edit-queue`, so if the edit path is already a sub-path of an existing storage root, that root will be used automatically.

---

## Step-by-Step Workflow

### 1. Add Photos to the Queue

With a photo selected, click the **Edit Queue** toolbar button (brain icon) and choose one of:

- **Add to Edit Queue** — adds the selected photo, optionally with an editing prompt
- **Edit Prompt** — update the prompt for a photo already in the queue

You can also open the **Edit Queue** dialog (View Queue) to see all queued photos, edit prompts inline, and remove individual entries.

### 2. Export

In the Edit Queue dialog:

1. Check the photos you want to export (or use **Select all**)
2. Click **Export (N)**

This copies the original files to `TEDOGRAPHY_EDIT_PATH` and writes two files:

- **`prompts.txt`** — one line per file: `filename: prompt`
- **`manifest.json`** — machine-readable metadata used during import (do not delete or rename this file)

### 3. Edit Externally

Open the exported files from `TEDOGRAPHY_EDIT_PATH` in any editing tool. When saving your results, follow this naming convention:

| Original | Edited file name |
|---|---|
| `IMG_1234.HEIC` | `IMG_1234_edited.jpg` |
| `IMG_1234.HEIC` | `IMG_1234_edited.png` |

Rules:
- The base name before `_edited` must match the original filename's base (case-insensitive)
- `_edited` must appear immediately before the file extension
- Any supported format is accepted as output (JPEG, PNG, HEIC, etc.)
- Save the edited file to the same folder (`TEDOGRAPHY_EDIT_PATH`) — do not move it elsewhere

### 4. Import

In the Edit Queue dialog, click **Import Edited Files**.

Tedography scans `TEDOGRAPHY_EDIT_PATH` for `*_edited.*` files, matches each one to its source via `manifest.json`, and imports it as a new asset. The imported asset inherits:

| Property | Source |
|---|---|
| Album memberships | Copied from original |
| Keywords | Copied from original |
| Location (lat/lon, city, state, country) | From edited file EXIF if present; otherwise from original |
| Capture date/time | From edited file EXIF if present; otherwise from original |
| People tags | Copied from original (source = manual-asset-tag) |
| Photo state | Always starts as **New** |

The original file is not modified.

### 5. After Import

- **Clear Queue** — removes all entries from the edit queue (does not affect files or assets)
- **Clear Edit Folder** — deletes exported originals, `manifest.json`, and `prompts.txt` from `TEDOGRAPHY_EDIT_PATH` (two-step confirmation required); use this after a successful import to clean up. **`_edited.*` files are intentionally preserved** — they are the originals backing imported assets and serve as the full-resolution source for `GET /media/original`.

---

## Import Result Status

Each file processed during import gets one of three statuses shown in the dialog:

| Status | Meaning |
|---|---|
| `imported` | Successfully created a new asset |
| `skipped` | File ignored (no matching manifest entry, or unsupported format) |
| `error` | Import failed (duplicate, missing storage root, etc.) |

Edit history is recorded for every file processed, including failures. View it via **Edit Queue → View Edit History**.

---

## Duplicate Import Error

If you attempt to import a file that was already imported (same path in the edit folder), you will see a duplicate key error. To reimport cleanly:

1. Find the existing asset in MongoDB (`originalStorageRootId: "edit-queue"`, `originalArchivePath: "your_edited_filename.ext"`)
2. Delete that document from the `mediaAssets` collection
3. Run **Import Edited Files** again

---

## Multiple Edits of the Same Photo

Currently, only one file per source photo can be imported per import pass — the file must be named exactly `{originalBasename}_edited.{ext}`. To import two different edited versions of the same photo, do two separate export → edit → import cycles, removing or renaming the first `_edited` file between rounds.

---

## Manifest File

`manifest.json` is written to `TEDOGRAPHY_EDIT_PATH` during export. It links edited filenames back to their source assets. **Do not delete or rename it** until after import is complete. Its format:

```json
{
  "exportedAt": "2026-05-30T00:00:00.000Z",
  "entries": [
    {
      "sourceAssetId": "uuid-of-original-asset",
      "originalFilename": "IMG_1234.HEIC",
      "originalBasename": "IMG_1234",
      "prompt": "optional editing prompt"
    }
  ]
}
```
