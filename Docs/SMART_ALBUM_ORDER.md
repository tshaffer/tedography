# Smart Album Order

This document describes Tedography's interleaved album ordering model
(Phases 0–4 of `ORDERING_PLAN.md`, implemented 2026-06).

## Purpose

Album ordering uses a single timeline per album:

- assets with a trustworthy `captureDateTime` sort chronologically and keep
  doing so automatically
- any asset can be **manually placed** anywhere in that timeline — including
  between two dated photos — by assigning it a virtual sort time
- undated assets that have never been placed sort at the end of the album

The goal: albums full of scans, phony dates, and real camera photos can be
curated into one correct visual order without repairing metadata first.

## Data Model

Album-specific ordering metadata lives on the asset's album membership:

```ts
albumMemberships?: Array<{
  albumId: string;
  manualSortOrdinal?: number | null;   // legacy; tiebreaker for unseeded photos
  forceManualOrder?: boolean | null;   // photo is manually placed in this album
  manualSortTime?: number | null;      // virtual sort time (epoch ms, fractional ok)
}>
```

`manualSortTime` is a double, so a midpoint exists between any two distinct
times — placement never requires renumbering neighbors. This is album-specific:
the same asset can be chronological in one album and placed in another.

## Ordering Rules

Every asset gets one **effective sort time** (`getEffectiveAlbumSortTime` in
`@tedography/shared`):

1. placed photo (`forceManualOrder` + `manualSortTime`) → its virtual time
2. chronological photo (usable `captureDateTime`, not forced) → its capture time
3. undated photo with a `manualSortTime` (pinned) → its virtual time
4. everything else → no time; sorts after all timed photos, ordered by the
   legacy chain (`manualSortOrdinal`, `importedAt`, filename)

Ties (e.g. identical-timestamp clumps) break by natural filename order —
numeric-aware, with `(n)` download suffixes grouping as separate rolls — then id.

## What the User Can Do

All of this requires exactly one checked album.

### Drag and drop (the primary gesture)

- **Any photo is draggable and any photo is a drop target.** A blue edge
  indicator shows whether the drop lands before (left) or after (right) the
  target.
- Dropping a photo **is** what converts it to manual placement; no mode toggle
  needed first.
- **Multi-select drag:** when the dragged photo is part of a multi-selection,
  the whole selection moves as a block, preserving its display order. All block
  members dim during the drag.
- Dropping "after" a member of an identical-timestamp clump lands after the
  whole clump (members of a clump are indistinguishable by time).

### Order in Album menu (toolbar overflow)

- **Use Manual Order** — pins the selected photos (multi-select OK) at their
  current positions; nothing visibly moves. A dated photo pins at its capture
  time; an undated one pins after everything timed.
- **Use Capture Time** — returns the selection to chronological ordering.
  `manualSortTime` is preserved so a later re-pin resumes the same position.
- **Arrange by Filename** — sorts the selection by natural filename order
  (rolls, numeric sequences) and re-places it as a block where the selection
  starts. Combined with block drag this is the whole roll-curation workflow:
  select roll → Arrange by Filename → drag block into position.
- **Move to top / up / down / bottom** — single-photo repositioning across the
  full album.

### Capture-date trust commands (overflow menu)

- **Mark Capture Date Wrong / Correct** — sets `captureDateTimeMarkedWrong` on
  the selection without changing any dates. For genuine EXIF dates from a
  camera whose clock was wrong.

### Visibility

- Inspector (single album + single asset): `Order in this Album`
  (Capture Time / Manual / Manual (No Capture Time)), plus provenance under
  Advanced: capture date source, camera, file EXIF date, marked-wrong flag.
- Optional **Ordering** thumbnail badge (off by default, in the badge toggles):
  amber `!` for suspect dates (`exif-weak`, `changed-after-import`, or
  marked-wrong), blue pin for manually placed photos in the checked album.

## Backend / API

- `POST /api/albums/:id/place` — `{ assetIds, placeAfterAssetId }`; the server
  computes virtual times (even spacing between distinct neighbors, clump-aware,
  pin-on-demand when the anchor has no effective time) via
  `apps/api/src/ordering/placementService.ts`.
- `POST /api/albums/:id/ordering-mode` — `{ assetIds, forceManualOrder }`;
  pin-in-place semantics.
- `PATCH /api/assets/capture-date-marked-wrong` — `{ assetIds, markedWrong }`.

The pre-interleaving `POST /api/albums/:id/manual-order` (ordinal rewriting)
was removed. Legacy ordinals were migrated to seeded `manualSortTime` values by
`pnpm manual-sort:migrate` (applied 2026-06-12; preserved the visible order).

## Capture date provenance (context)

Placement decisions lean on the provenance fields backfilled in Phase 1:
`captureDateTimeSource` (`exif-original` / `exif-weak` / `changed-after-import`
/ `manual` / `none`), `exifCaptureDateTime`, `cameraMake`/`cameraModel`, and
the user-set `captureDateTimeMarkedWrong`. "Suspect" anywhere in the UI means
`exif-weak` ∪ `changed-after-import` ∪ marked-wrong.

## Scope and Limits

- reordering requires exactly one checked album; multi-album views stay
  conservative (no cross-album manual ordering model)
- within an identical-timestamp clump, relative order is filename-based; to
  fully control a clump's internal order, place its members (drag or Arrange
  by Filename), which gives them distinct virtual times
- placed photos hold absolute virtual times: correcting a neighbor's capture
  date moves the neighbor, not the placed photo

## Possible Future Improvements

- keyboard shortcuts for repositioning
- batch "shift capture dates by a known offset" for wrong-clock batches
  (provenance and `exifCaptureDateTime` preserve what's needed)
- metadata repair workflow with before/after comparison
