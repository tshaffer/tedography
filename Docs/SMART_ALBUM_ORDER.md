# Smart Album Order

This document describes what Tedography currently implements for album ordering and album-specific reordering.

## Purpose

Tedography album ordering now uses a hybrid model:

- assets with a usable `captureDateTime` can still sort chronologically
- assets without a usable `captureDateTime` can be manually ordered within an album
- assets with a parseable but wrong `captureDateTime` can be forced into manual ordering for a specific album

The goal is to make album browsing look more natural without requiring the user to first repair metadata.

## Current Data Model

Album-specific ordering metadata lives on the media asset's album membership data.

Current membership shape:

```ts
albumMemberships?: Array<{
  albumId: string;
  manualSortOrdinal?: number | null;
  forceManualOrder?: boolean | null;
}>
```

Meaning:

- `albumId`: the album this membership metadata applies to
- `manualSortOrdinal`: the asset's relative position in the album's manual-order section
- `forceManualOrder`: if `true`, this asset uses manual ordering in that album even if it has a usable `captureDateTime`

This is album-specific, not global. The same asset can use capture-time ordering in one album and manual ordering in another.

## Current Smart Album Order Rules

In album-scoped views, ordering currently works like this:

1. Assets using capture-time ordering sort first by `captureDateTime` ascending.
2. Assets using manual ordering sort after the capture-time section.
3. Inside the manual section:
   - `manualSortOrdinal` ascending
   - then `importedAt`
   - then `filename`
   - then `id`

An asset uses capture-time ordering in an album only when:

- it belongs to that album
- it has a usable `captureDateTime`
- `forceManualOrder !== true` for that album

An asset uses manual ordering in an album when either:

- `forceManualOrder === true` for that album
- or it does not have a usable `captureDateTime`

## What the User Currently Sees

### Album Results

When browsing a single checked album, the visible asset order follows Smart Album Order.

Effects the user will see:

- dated assets appear first in chronological order
- no-date assets appear after them
- assets explicitly forced to manual order also appear in the manual section

### Inspector

When exactly one album is checked and exactly one asset is selected, the Inspector shows:

- `Order in this Album: Capture Time`
- `Order in this Album: Manual`
- `Order in this Album: Manual (No Capture Time)`

This is intentionally only shown in the unambiguous single-album context.

### Toolbar Actions

When exactly one album is checked and exactly one asset is selected, the secondary toolbar can show:

- `Use Manual Order`
- `Use Capture Time`
- move to top
- move up
- move down
- move to bottom

Current behavior:

- `Use Manual Order`
  - available when the selected asset is currently using capture-time ordering in the checked album
  - moves that asset into the album's manual section
- `Use Capture Time`
  - available when the selected asset is currently forced-manual in the checked album
  - returns that asset to chronological ordering in that album
- move controls
  - available only for assets currently using manual ordering in the checked album

## What the User Can Change Today

### 1. Force an asset into manual ordering for an album

In a single checked album:

- select one asset
- click `Use Manual Order`

Result:

- the asset leaves the chronological section for that album
- it enters the manual section
- if it did not already have a `manualSortOrdinal`, Tedography assigns one at the end of the current manual section
- the change persists to MongoDB

### 2. Return an asset to capture-time ordering

In a single checked album:

- select one asset that is currently forced-manual
- click `Use Capture Time`

Result:

- the asset stops using manual ordering in that album
- it re-enters chronological ordering based on `captureDateTime`
- the change persists to MongoDB

Current implementation choice:

- `manualSortOrdinal` is preserved when switching back to capture-time ordering

Reason:

- this is simpler and less error-prone
- if the user later switches the asset back to manual ordering, it can resume a stable prior position

### 3. Reposition a manual-order asset

In a single checked album:

- select one asset that is currently using manual ordering
- use the move buttons in the secondary toolbar

Current supported moves:

- move to top
- move up
- move down
- move to bottom

Result:

- only the manual section of that album is reordered
- the updated `manualSortOrdinal` values persist to MongoDB

## Current Scope and Limits

This is intentionally a small, reliable slice.

Current constraints:

- best supported when exactly one album is checked
- toolbar actions work only when exactly one asset is selected
- no drag-and-drop yet
- no explicit metadata-correction workflow yet
- no explicit "capture time is wrong" flag yet
- no thumbnail-level ordering badges were added, to keep the UI low-clutter

Multi-album checked views are still intentionally conservative. Tedography does not try to invent a combined cross-album manual ordering model.

## Backend / API Currently in Use

Relevant routes:

- `POST /api/albums/:id/manual-order`
- `POST /api/albums/:id/ordering-mode`

Conceptually:

- `manual-order` persists reordered asset ids for the album's manual section
- `ordering-mode` toggles `forceManualOrder` for a specific asset in a specific album

## Likely Future Improvements

The following would be natural next steps.

### Better manual reordering UX

- drag-and-drop inside a single checked album
- move before / move after specific item commands
- keyboard shortcuts for manual section movement

### Better visibility

- subtle album-ordering hint in the action bar
- optional lightweight thumbnail indicator in album-scoped views only
- explicit grouping labels in the UI such as "Chronological" and "Manual"

### Better handling of bad timestamps

- an explicit per-album or per-asset "capture time should not be trusted" concept
- a metadata repair workflow to update `captureDateTime`
- side-by-side tooling to compare album ordering before/after metadata correction

### Better multi-album behavior

- clearer grouped display for multiple checked albums
- more explicit handling of merged results when several albums are checked

## Summary

Tedography now supports a practical first version of Smart Album Order:

- chronological ordering where timestamps are usable
- manual ordering where timestamps are missing
- manual override where timestamps are parseable but wrong
- album-specific persistence of those choices

The current UX is intentionally tight:

- selected asset
- single checked album
- clear ordering status in the Inspector
- simple toolbar actions to switch ordering mode and reposition manual items
