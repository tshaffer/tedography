# Plan: Flexible Photo Ordering Within Albums

> Drafted 2026-06-12 with Claude. Status: Phases 0–3 complete (2026-06-12).
> Provenance backfilled (17,021 assets; 2 anomalies pending). Interleaved ordering live:
> manualSortTime model, /place endpoint, drag-anywhere + block drag UI; migration seeded
> 132 legacy manual photos in one album (mongodumps in ~/tedography-backups/).
> Phase 3 note: 3.1–3.3 collapsed into one "Arrange by Filename" command — the Phase 0
> natural comparator already encodes roll semantics ((n)-suffix-major, numeric), so a
> separate sequence-detection module wasn't needed; "place sequence here" = block drag +
> Arrange by Filename. Next: Phase 4 (inspector provenance, optional badge, docs).

## Goal State

Every photo in an album occupies one orderable position:

- Photos with **genuine EXIF dates** sort chronologically and keep doing so automatically.
- **Undated and phony-dated** photos can be placed anywhere — interleaved with the
  chronological stream — via drag-and-drop.
- **Bulk tools** (multi-select drag, filename-sequence arrangement) make it practical to
  place whole rolls of film without dragging photos one at a time.
- **Date provenance** (where each `captureDateTime` came from) is a stored, queryable fact
  in MongoDB, fully backfilled from the original files.

## Background

The current model (see `SMART_ALBUM_ORDER.md`) is a two-bucket sort: capture-time photos
first, then a quarantined manual section. Intermixing is structurally impossible, and
converting photos to manual ordering is one-at-a-time.

Many stored capture dates are phony: assigned in bulk when a year was guessed (clumps of
identical timestamps), baked in by Google Takeout before import, or silently inherited
from a file's `ModifyDate` via the import fallback chain
(`DateTimeOriginal → CreateDate → MediaCreateDate → SubSecDateTimeOriginal →
TrackCreateDate → ModifyDate`). Empirically (Compass analysis, June 2026): hour-boundary
timestamps identified ~103 suspect photos; identical-timestamp clumps confirmed the large
groups and produced only camera-burst false positives beyond them.

A separate case: a camera whose clock was set wrong writes genuine EXIF that is
nonetheless inaccurate. Provenance and accuracy are different dimensions; the design keeps
them in separate fields.

## Settled Design Decisions

1. **Virtual sort times, not anchors.** A manually placed photo stores an absolute
   `manualSortTime` on its album membership. The album sorts by one effective key:
   real `captureDateTime` for chronological photos, `manualSortTime` for manual ones.
   Manual placements do not follow later date corrections of their neighbors.
2. **Dragging is the conversion.** Dropping any photo — including a genuinely dated one —
   silently converts it to manual placement in that album. No prior mode toggle. "Use
   Capture Time" remains the one-click revert. Dragging genuinely dated photos is allowed
   without warning.
3. **Provenance classification table** (machine facts only, never user judgment):

   | Date came from | Camera Make/Model present | Classification |
   |---|---|---|
   | `DateTimeOriginal` / `SubSecDateTimeOriginal` | either way | `exif-original` |
   | `CreateDate` / `MediaCreateDate` / `TrackCreateDate` | yes | `exif-original` |
   | `CreateDate` / `MediaCreateDate` / `TrackCreateDate` | no | `exif-weak` |
   | `ModifyDate` | either way | `exif-weak` |

   Additional values: `changed-after-import` (Mongo date differs from file EXIF),
   `manual` (stamped going forward by the Set Capture Date endpoint), `none` (no date).
4. **Wrong-clock camera dates** (genuine EXIF, inaccurate value) are handled by a
   separate user-set flag `captureDateTimeMarkedWrong`, never by bending the
   classification. Tooling treats **suspect = `exif-weak` ∪ marked-wrong**.
5. **New imports into a curated album:** genuinely dated photos slot in chronologically;
   undated photos land at the end of the album.
6. **Classification changes tooling defaults only, never sorting.** A suspect-dated photo
   keeps sorting by its date until explicitly moved.

## Phase 0 — Quick win, no schema changes

- **0.1 Natural-order filename tiebreaker.** Replace the plain `localeCompare` filename
  tiebreaker in the sort comparator with numeric-aware, `(n)`-duplicate-suffix-aware
  comparison. Identical-timestamp clumps immediately display in roll order.
- **0.2 Consolidate the comparator into `@tedography/shared`** (currently duplicated
  between `apps/web/src/utilities/smartAlbumOrder.ts` and parts of the API) so later
  phases change ordering logic in one place. Dependency rules allow this: both web and
  api may depend on shared.

*Deliverable: clumps look right. Risk: trivial. No DB changes.*

## Phase 1 — Date provenance (schema + backfill)

- **1.1 Schema.** New optional `MediaAsset` fields:
  - `captureDateTimeSource`:
    `'exif-original' | 'exif-weak' | 'changed-after-import' | 'manual' | 'none'`
  - `exifCaptureDateTime` — the date as it exists in the original file (evidence;
    enables reclassification and "restore original date" later)
  - `cameraMake`, `cameraModel`
  - `captureDateTimeMarkedWrong` — user judgment flag, independent of provenance
- **1.2 Keep it from going stale.** Import pipeline records which EXIF tag the date came
  from. Set Capture Date endpoint stamps `'manual'` on every future edit.
  *Implementation note: the live extraction path is `apps/api/src/import/exifMetadata.ts`
  (`extractImportMetadata`), not the `@tedography/media-metadata` package — that package
  has no live consumers. The winning-tag extraction and the classifier live in
  `apps/api/src/import/` (`exifMetadata.ts`, `captureProvenance.ts`). Reimport
  (refreshService) also refreshes provenance; rebuild-derived does not touch it.*
- **1.3 Backfill script** `capture-provenance:backfill` (modeled on `locations:backfill`):
  - Dry-run by default: writes nothing; emits a JSON report
    (`reports/capture-provenance-<timestamp>.json`) with per-asset classification,
    file EXIF date, Mongo date, camera tags — plus a console summary of counts per
    classification and anomalies (unreadable/missing originals).
  - Report includes wrong-clock aids: a camera-model × year count matrix, and exact
    hits on classic clock-reset dates (`2000-01-01`, `1980-01-01`, epoch).
  - `--apply` bulk-writes only the new fields. Never modifies `captureDateTime`.
    Never writes to photo files (exiftool is read-only). Idempotent and resumable;
    re-stamp only with `--force`.
- **1.4 Execution order:** `mongodump` of `mediaAssets` → dry-run → review the report
  together and tune classification rules → `--apply`.

*Deliverable: genuine-vs-phony is queryable in Compass and available to the UI.
Review gate: nothing written until the dry-run report is reviewed.*

## Phase 2 — Interleaved ordering model (the core)

- **2.1 Schema.** Add `manualSortTime` (epoch ms or ISO string — decide at
  implementation) to `MediaAssetAlbumMembership`. Keep `forceManualOrder` as the mode
  flag; keep `manualSortOrdinal` for migration/back-compat.
- **2.2 New comparator** in `shared`: single effective-time key, then natural filename,
  then id. Deletes the two-bucket model. Update the API mirror that derives the
  ordering-mode label.
- **2.3 Migration script** for existing manual-section photos: seed `manualSortTime`
  after each album's last capture time, preserving today's visible order exactly.
  Dry-run → mongodump → apply.
- **2.4 API.** New placement endpoint: "place assets [X…] between A and B in album N."
  Server computes virtual times, including re-spreading inside identical-timestamp
  clumps (the degenerate-midpoint case).
- **2.5 UI.** Drag any photo in a single-checked album; any photo is a valid drop
  target. Multi-select drag moves the whole selection as a block, preserving internal
  order. "Use Capture Time" / "Use Manual Order" accept multi-selections.

*Deliverable: the Unfiled workflow — drag anything anywhere.
Review gate: migration dry-run report before apply.*

## Phase 3 — Bulk tools

- **3.1 Filename sequence detection** utility: parse `(prefix, number, (n)-suffix)`;
  group into rolls. The `(n)` suffix is a duplicate-name discriminator marking parallel
  rolls, not within-roll order; use `originalContentHash` to distinguish parallel rolls
  from true duplicate files. Names without numeric structure (e.g. `Scan2<uuid>`) carry
  no signal and stay purely manual.
- **3.2 "Arrange by filename sequence"**: orders the selected photos' manual placements
  by detected sequence — one click per clump.
- **3.3 "Place sequence here"**: position the first photo of a roll by drag, invoke the
  command, and the rest of the roll's virtual times distribute after it.
- **3.4 "Mark capture date as wrong / correct"** bulk command on a selection (sets
  `captureDateTimeMarkedWrong`).

*Deliverable: a 30-photo roll takes one drag + one click instead of 30 drags.*

## Phase 4 — Visibility & polish

- **4.1** Inspector shows provenance for the selected photo (source, camera, file date,
  marked-wrong).
- **4.2** Optional, off-by-default thumbnail indicator for manually placed and
  suspect-dated photos (low-clutter preference).
- **4.3** Docs: update `SMART_ALBUM_ORDER.md`, `TEDOGRAPHY_USER_MANUAL.md`,
  `CLAUDE_PROJECT_SUMMARY.md`.

## Cross-Cutting

- `pnpm -r typecheck` after every change; API tests for the comparator, placement math,
  and sequence parser (`pnpm --filter @tedography/api test`).
- Every DB-writing script: dry-run default, report file, `mongodump` before apply.
- Phases 0 and 1 are independent of Phase 2; provenance-first lets the Phase 2 UI be
  smart from day one.

## Deferred / Open

- Batch "shift capture dates by a known offset" tool for wrong-clock batches — only
  worthwhile once a concrete offset is known for a batch; the preserved
  `exifCaptureDateTime` and untouched provenance keep this possible.
- Cross-roll ordering hints (nothing in filenames says roll `(1)` precedes roll `(2)`)
  — intentionally left to manual placement.
