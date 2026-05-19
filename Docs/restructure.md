Good — the `duplicate-cli` also resolves paths by ID at runtime, so it's subject to the same rename. Now I have everything needed for the complete list:

---

## Complete updated list

### Step 1 — Move directories on disk
```
mkdir /Volumes/ShMedia/Tedography
mv "/Volumes/ShMedia/Shafferography/ShafferographyMediaNew"  "/Volumes/ShMedia/Tedography/Media"
mv "/Volumes/ShMedia/Tedography-AI-Queue"                    "/Volumes/ShMedia/Tedography/AI-Queue"
mv "/Volumes/ShMedia/TedographyDerived"                      "/Volumes/ShMedia/Tedography/Derived"
mv "/Volumes/ShMedia/TedographyImportStaging"                "/Volumes/ShMedia/Tedography/ImportStaging"
mv "/Volumes/ShMedia/TedographyUnrotated"                    "/Volumes/ShMedia/Tedography/Unrotated"
```

---

### Step 2 — Update `apps/api/.env`

| Variable | New value |
|---|---|
| `TEDOGRAPHY_STORAGE_ROOTS` | `tedographymedia\|Tedography Media\|/Volumes/ShMedia/Tedography/Media` |
| `TEDOGRAPHY_DERIVED_ROOT` | `/Volumes/ShMedia/Tedography/Derived` |
| `TEDOGRAPHY_UNROTATED_ROOT` | `/Volumes/ShMedia/Tedography/Unrotated` |
| `CANON_TO_TEDOGRAPHY_DEST_ROOT` | `/Volumes/ShMedia/Tedography/ImportStaging` |
| `TEDOGRAPHY_AI_QUEUE_EXPORT_PATH` | `/Volumes/ShMedia/Tedography/AI-Queue` |
| `duplicate-cli_TEDOGRAPHY_STORAGE_ROOTS` | `tedographymedia\|Tedography Media\|/Volumes/ShMedia/Tedography/Media` |

---

### Step 3 — Write and run a MongoDB migration script
Update `originalStorageRootId` and `displayStorageRootId` on all `mediaAsset` documents that still reference the old ID:
```js
db.mediaAssets.updateMany(
  { originalStorageRootId: 'shafferographymedia' },
  { $set: { originalStorageRootId: 'tedographymedia' } }
)
db.mediaAssets.updateMany(
  { displayStorageRootId: 'shafferographymedia' },
  { $set: { displayStorageRootId: 'tedographymedia' } }
)
```
I'll write this as a proper `tsx` tool script with dry-run / --apply, consistent with the other migration tools.

---

### Step 4 — Update source files

| File | Change |
|---|---|
| `scripts/backup.sh` | Both rsync paths: `Shafferography/ShafferographyMediaNew/` → `Tedography/Media/` |
| `scripts/copy-missing-imports.mjs` | `DEST_ROOT` constant and header comments |
| `scripts/canon-to-tedography-plan.ts` | `CANON_TO_TEDOGRAPHY_DEST_ROOT` example in usage comment |
| `scripts/find-duplicate-files.ts` | Commented-out example path in `SCAN_DIRECTORIES` |

---

### Step 5 — Update documentation

| File | Change |
|---|---|
| `Docs/IMPORT_BROWSE_AND_SCAN_MANUAL_TESTS.md` | Three hardcoded `TedographyDerived` paths in example shell commands |

---

### Step 6 — Verify
- Run the migration script in dry-run mode first, then `--apply`
- Restart the API server
- Run `pnpm thumbnails:verify` to confirm derived paths resolve
- Spot-check browsing and media serving in the UI

---

Shall I start with the migration script (step 3) and the source/doc updates (steps 4–5), while you handle steps 1 and 2?