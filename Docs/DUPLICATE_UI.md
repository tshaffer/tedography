# Tedography Duplicate UI

This document describes the duplicate-related user interface currently implemented in Tedography.

It is usage-focused. It explains what the duplicate screens do, how they relate to each other, and what the visible duplicate states mean.

## 1. Main Duplicate Surfaces

Tedography currently has two main duplicate review surfaces:

1. `Duplicate Group Review`
   Route: `/duplicates/groups`
2. `Duplicate Pair Review`
   Route: `/duplicates/review`

The group workflow is now the primary workflow for resolving duplicate sets.

The pair workflow remains available for lower-level cleanup and legacy review.

## 2. Duplicate Group Review

Route:

- `/duplicates/groups`

Purpose:

- review duplicates as groups rather than only as pairs
- choose one keeper for a provisional group
- mark the remaining assets as duplicates or excluded from that group
- revisit already-resolved groups when new candidate evidence appears

### 2.1 Provisional Groups

The left sidebar shows provisional duplicate groups.

Each group is derived from current duplicate-candidate relationships.

The list is ordered by review priority:

1. `Needs Re-review`
2. `Unresolved`
3. `Resolved`

Within each status bucket, larger groups appear first.

### 2.2 Group Statuses

Each provisional group is shown in one of three states:

- `Unresolved`
  - no confirmed group resolution exists yet
- `Resolved`
  - the current group has a confirmed duplicate resolution
- `Needs Re-review`
  - a confirmed group exists, but new candidate connectivity or later low-level review means the group should be revisited

`Needs Re-review` is now backed by persisted backend state, not only by frontend inference.

### 2.3 Page Summary

Near the top of the page, Tedography shows counts for:

- `Needs Re-review`
- `Unresolved`
- `Resolved`

These counts reflect the whole current provisional-group queue, not only the currently loaded sidebar items.

### 2.4 Group Detail Summary

When a group is selected, the detail pane shows:

- review status
- asset count
- candidate pair link count
- current canonical asset if one is already resolved

It also shows a `Resolution Rules` summary:

- keeper chosen
- duplicates
- not in group
- unclassified

### 2.5 Resolution Controls

Each asset in the group can be marked as:

- `Keeper`
- `Duplicate`
- `Not In Group`

Rules:

- exactly one asset must be the keeper
- every other shown asset must be explicitly classified
- the group cannot be saved until all assets are classified

### 2.6 Meaning Of `Not In Group`

`Not In Group` means:

- this asset is excluded from the current duplicate-set resolution

It does **not** mean:

- the asset is globally settled
- the asset is not a duplicate of anything else in the archive

An excluded asset may still appear later in another provisional group if candidate relationships elsewhere justify it.

### 2.7 Grid Mode

Grid Mode shows the whole provisional group at once.

Each card shows:

- image preview
- filename
- asset id
- current decision in the group
- historical hint counts, when loaded
- action buttons for `Keeper`, `Duplicate`, and `Not In Group`
- compare-set toggle

Grid Mode is best for:

- quick classification of the whole set
- choosing the keeper while seeing all members together

### 2.8 Focus Mode

Focus Mode shows one asset large at a time with a candidate list on the right.

It uses the same working state as Grid Mode. Switching modes does not reset the current decisions.

Focus Mode supports:

- large image inspection
- up/down arrow navigation
- wraparound navigation at the ends
- compare subset workflow

### 2.9 Compare Subset In Focus Mode

When comparing a few candidates within a larger group, you can build a temporary compare subset.

You can:

- add assets to `Compare`
- remove them from `Compare`
- switch Focus Mode between:
  - `View All`
  - `Compare Set`

When `Compare Set` is active:

- the right-hand candidate list narrows to that subset
- up/down arrow navigation moves only within that subset

This compare subset is temporary UI state for the current review session. It does not change duplicate resolution semantics by itself.

### 2.10 Historical Hints

Historical hints are optional and loaded on demand with:

- `Load Historical Hints`

When loaded, an asset can show best-effort counts for how often it has historically appeared as:

- keeper
- duplicate
- not duplicate

These counts are informational only. They do not automatically choose the final keeper.

Older pair-review history is not perfectly directional in all cases, so these are best-effort hints for legacy data.

### 2.11 Save And Reopen

Main actions:

- `Save Group Resolution`
- `Reopen Group`

Saving a group resolution:

- confirms one keeper and zero or more duplicates
- removes excluded assets from the resolved duplicate set
- updates Library duplicate visibility

Reopening a group:

- clears the current confirmed group resolution for that exact group
- returns it to active review

## 3. Duplicate Pair Review

Route:

- `/duplicates/review`

Purpose:

- inspect and review candidate pairs one pair at a time
- do lower-level cleanup work
- preserve continuity with older pair-oriented review workflow

The pair-review page remains useful, but it is no longer the authoritative place to finalize duplicate sets once a group has been resolved in `/duplicates/groups`.

### 3.1 Pair Review Actions

The pair workflow supports decisions such as:

- keep left
- keep right
- keep both
- not duplicate
- uncertain
- ignore

### 3.2 Pair Review Coexistence Guardrails

If a pair-review action touches an already confirmed duplicate group:

- Tedography still saves the pair review itself
- but pair review does **not** silently override the confirmed group resolution
- instead, Tedography marks the affected duplicate group for re-review
- the pair-review page shows a notice telling you that Duplicate Group Review is now the right place to revisit the conflict

This prevents low-level pair review from quietly undoing an authoritative group resolution.

## 4. Needs Re-review

`Needs Re-review` is the key bridge between the two duplicate workflows.

Tedography uses it when:

- a previously resolved group is touched by broader candidate connectivity
- a pair-review action conflicts with an already confirmed group resolution

When a group is marked `Needs Re-review`:

- the current confirmed result still exists
- but Tedography is telling you that the group should be revisited in `/duplicates/groups`

Tedography does **not** silently merge the new candidate into the old group result.

## 5. Library Behavior

Confirmed duplicate resolution affects the main app Library.

### 5.1 Duplicate Visibility

In Library:

- the selected canonical asset is treated as the keeper
- confirmed non-canonical members are treated as duplicates

The duplicate-group workflow now refreshes Library duplicate visibility after:

- saving a group resolution
- reopening a group

The UI also uses optimistic updates so the change can be reflected promptly before a full duplicate-visibility refresh completes.

### 5.2 Keeper / Duplicate Meaning

Library badges such as `Keeper` and `Duplicate` are driven by confirmed duplicate-group resolution, not by unresolved candidate relationships alone.

## 6. How Excluded Assets Are Revisited

If you exclude assets from a group by marking them `Not In Group`, Tedography does not manually place them into another group for you.

Instead:

1. the current group is saved
2. provisional candidate groups are re-derived from existing candidate relationships
3. excluded assets can later appear in other provisional groups if candidate links still connect them elsewhere

If you want Tedography to reconsider regrouping after a series of saves, use:

- `Refresh Groups`

This forces the provisional-group queue to be reloaded from current duplicate-candidate connectivity.

## 7. Current Practical Workflow

Recommended duplicate workflow in Tedography:

1. Open `/duplicates/groups`
2. Work through `Needs Re-review` groups first
3. Then work through `Unresolved` groups
4. Use Grid Mode for broad classification
5. Use Focus Mode and Compare Set for careful visual comparison
6. Save the authoritative group resolution
7. Use `/duplicates/review` only for lower-level pair cleanup or edge cases

## 8. Current Limitations

Current limitations to keep in mind:

- historical keeper/duplicate counts are best-effort for older pair-review data
- excluded assets only regroup if supporting candidate pairs already exist
- Tedography does not yet provide a large “global duplicate maintenance dashboard”
- group rereview is supported, but the system still favors explicit user confirmation over automatic regrouping

## 9. Related Docs

- [`Docs/DUPLICATE_GROUP_UI_SPEC.md`](./DUPLICATE_GROUP_UI_SPEC.md)
- [`Docs/DUPLICATE_GROUP_UI_IMPLEMENTATION_PLAN.md`](./DUPLICATE_GROUP_UI_IMPLEMENTATION_PLAN.md)
