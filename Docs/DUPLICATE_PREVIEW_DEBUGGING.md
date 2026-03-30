# Duplicate Preview Debugging

This document explains how to compare Tedography duplicate-group state before and after using `Min Score Preview` in `/duplicates/groups`.

Use this when preview seems to surface groups that feel already resolved, or when you want to verify that preview is not persisting duplicate-review state.

## Goal

When duplicate preview is working correctly:

- duplicate candidate graph can change
- provisional duplicate groups can change
- confirmed duplicate group resolutions should not change
- rereview flags should not change

If confirmed resolutions or rereview flags change after preview-only, that is a bug.

## Recommended Workflow

1. Record current confirmed duplicate-group state.
2. Record current rereview state.
3. Apply a preview threshold in `/duplicates/groups`.
4. Run the same queries again.
5. Compare results.

The easiest way is to copy the query output into two text files:

- `before-preview.txt`
- `after-preview.txt`

Then compare them with your preferred diff tool.

## 1. Confirmed Group Resolutions

This query shows the currently confirmed duplicate groups.

```javascript
db.duplicateGroupResolutions.find(
  { resolutionStatus: "confirmed" },
  {
    _id: 0,
    groupKey: 1,
    assetIds: 1,
    proposedCanonicalAssetId: 1,
    manualCanonicalAssetId: 1,
    rereviewRequiredAt: 1
  }
).sort({ groupKey: 1 })
```

Expected behavior:

- preview-only should not change these rows

If these rows change after preview-only, that is a bug.

## 2. Confirmed Groups Marked For Re-review

This query shows confirmed duplicate groups that currently have a rereview flag.

```javascript
db.duplicateGroupResolutions.find(
  {
    resolutionStatus: "confirmed",
    rereviewRequiredAt: { $ne: null }
  },
  {
    _id: 0,
    groupKey: 1,
    assetIds: 1,
    rereviewRequiredAt: 1
  }
).sort({ rereviewRequiredAt: 1, groupKey: 1 })
```

Expected behavior:

- preview-only should not add rows here

If new rows appear after preview-only, that is a bug.

## 3. Candidate Pairs Used By A Preview Threshold

Replace `0.99` with whatever preview threshold you are testing.

```javascript
db.duplicateCandidatePairs.find(
  {
    classification: { $in: ["very_likely_duplicate", "possible_duplicate"] },
    status: { $in: ["unreviewed", "reviewed"] },
    outcome: { $in: [null, "confirmed_duplicate", "ignored"] },
    score: { $gte: 0.99 }
  },
  {
    _id: 0,
    assetIdA: 1,
    assetIdB: 1,
    score: 1,
    classification: 1,
    status: 1,
    outcome: 1
  }
).sort({ assetIdA: 1, assetIdB: 1 })
```

This query does not tell you whether preview is correct by itself. It tells you what duplicate-candidate graph the preview is actually using.

## 4. Before / After Procedure

### Before preview

Run:

1. Confirmed group resolutions query
2. Confirmed rereview query

Save the output.

### During preview

In Tedography:

1. Open `/duplicates/groups`
2. Set `Min Score Preview`
3. Click `Preview Groups`

### After preview

Run the same two queries again:

1. Confirmed group resolutions query
2. Confirmed rereview query

Expected:

- same confirmed groups
- same rereview rows

If preview is behaving correctly, only the provisional UI should change.

## 5. Investigating A Suspicious Preview Group

If preview shows a group as unresolved and you want to know whether it is already covered by a confirmed group, take the asset ids from the preview group and run:

```javascript
const previewGroup = [
  "assetId1",
  "assetId2",
  "assetId3"
];

db.duplicateGroupResolutions.find(
  {
    resolutionStatus: "confirmed",
    assetIds: { $in: previewGroup }
  },
  {
    _id: 0,
    groupKey: 1,
    assetIds: 1,
    proposedCanonicalAssetId: 1,
    manualCanonicalAssetId: 1,
    rereviewRequiredAt: 1
  }
)
```

Interpretation:

- if this returns a confirmed group containing all preview assets, the preview group may already be covered by existing resolved state
- if it returns only partial overlaps, the preview group may be surfacing a real broader or different candidate context

## 6. What Counts As A Bug

Preview-only is buggy if:

- `duplicateGroupResolutions` rows change after preview-only
- new `rereviewRequiredAt` rows appear after preview-only
- existing confirmed resolutions are altered without explicitly saving a group resolution

Preview-only is behaving as expected if:

- confirmed rows do not change
- rereview rows do not change
- only the provisional duplicate groups shown in the UI change

## 7. Optional Additional Count Checks

Confirmed group count:

```javascript
db.duplicateGroupResolutions.countDocuments({
  resolutionStatus: "confirmed"
})
```

Confirmed rereview count:

```javascript
db.duplicateGroupResolutions.countDocuments({
  resolutionStatus: "confirmed",
  rereviewRequiredAt: { $ne: null }
})
```

These are useful for quick sanity checks before doing the fuller row-level comparison.
