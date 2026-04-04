# Selection Ordering

This note documents how Tedography orders the current media selection.

The selection is stored as `selectedAssetIds` in [`apps/web/src/App.tsx`](/Users/tedshaffer/Documents/Projects/tedography/apps/web/src/App.tsx). It is an ordered array, but it is not continuously normalized to a single canonical sort such as filename, capture date, or asset ID.

## How Order Is Created

- Single click sets the selection to exactly `[assetId]`.
- `Cmd` / `Ctrl` toggle-add appends the asset ID to the end of the current array.
- `Cmd` / `Ctrl` toggle-remove removes that asset ID and preserves the remaining order.
- `Shift` range selection rebuilds the selection from the current `visibleAssets` order.
- `Cmd+A` / `Ctrl+A` rebuilds the selection from the current `visibleAssets` order.
- Visibility/filter changes prune the selection to still-visible items while preserving the existing array order.

## Practical Rule

The effective ordering algorithm is:

1. Preserve insertion order for incremental toggle selection.
2. Use current `visibleAssets` order for range and bulk selection.
3. Preserve current order when removing or pruning selected items.

## Important Nuance

Many downstream UI flows do not display items in `selectedAssetIds` order directly.

Selected subsets are often derived like this:

```ts
visibleAssets.filter((asset) => selectedAssetIds.includes(asset.id))
```

That means those views are ordered by `visibleAssets`, not by the historical order inside `selectedAssetIds`.

## Consequence

If selection order matters for a feature, do not assume:

- the order is chronological
- the order is filename-sorted
- the order reflects most-recent click in all cases

Instead, check whether the feature is consuming:

- `selectedAssetIds` directly
- or a derived subset rebuilt from `visibleAssets`
