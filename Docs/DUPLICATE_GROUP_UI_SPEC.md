# Tedography Duplicate Group UI Spec

This document describes the proposed product model and user experience for a new duplicate-group review UI in Tedography.

It is intentionally product-focused rather than backend-focused.

It describes the intended behavior before implementation.

## Purpose

The current duplicate workflow is heavily pair-oriented.

The new UI should let the user resolve duplicates in the way people naturally think about them:

- start from a provisional group of possible duplicates
- look at all assets in that group together
- choose one keeper
- mark the rest as duplicates or exclude them from the group

This new UI should become the preferred workflow for duplicate-set resolution, while the existing pair-review workflow remains available for lower-level cleanup and edge cases.

## Core Concepts

### Provisional Candidate Group

A provisional candidate group is a temporary working set of assets that may be duplicates of each other.

Important properties:

- it is derived from duplicate-candidate relationships
- it is dynamic, not permanent
- membership can change as the user reviews and excludes assets
- it is a review bucket, not final truth

### Resolved Duplicate Group

A resolved duplicate group is the final user-confirmed duplicate set for a subset of assets.

Important properties:

- it contains exactly one keeper
- all other included assets are duplicates
- it drives Library duplicate behavior such as `Keeper` / `Duplicate`
- it is stable, but not permanent

### Stable But Not Permanent

A resolved duplicate group should be treated as stable until new evidence connects additional assets to it.

If that happens:

- the existing resolved group is marked as needing re-review
- the user must explicitly confirm the updated group
- Tedography must not silently change the resolved keeper/duplicate set

## Resolution Model

Within one provisional candidate group:

- exactly one asset must be marked `Keeper`
- every other visible asset must be explicitly marked as either:
  - `Duplicate`
  - `Not In This Group`
- the group is not complete until all shown assets are classified

### Meaning Of States

#### Keeper

The keeper is the surviving asset for the resolved duplicate set.

There must be exactly one keeper in a completed group resolution.

#### Duplicate

A duplicate is part of the resolved duplicate set, but is not the keeper.

Duplicates can be shown as suppressed in Library unless the user chooses to reveal suppressed duplicates.

#### Not In This Group

`Not In This Group` means:

- this asset is excluded from the current resolved duplicate set
- it is not being treated as part of the current keeper/duplicate decision

It does **not** mean:

- the asset is not a duplicate of anything else in the archive
- the asset is globally settled forever

An asset excluded from one group can later appear in another candidate group if remaining candidate relationships still justify that.

## Historical Pair Review Data

Existing duplicate pair review data should be used as context, not as the final authority for the new UI.

Historical pair markings are hints only.

The new group UI is authoritative for final duplicate-group resolution.

### Historical Hints To Show

For each asset in the group UI, Tedography should show the number of times that asset has historically been marked in pair review as:

- keeper
- duplicate
- not duplicate

Optional additional hints if useful:

- uncertain count
- unreviewed count

These counts are informational only. They help the user understand prior review history, but they do not automatically choose the final keeper.

## Leftovers And Exclusions

When a provisional group contains assets `A, B, C, D` and the user determines that:

- `A` and `B` are duplicates
- `C` and `D` are not part of that duplicate set

then the result should be:

- resolved duplicate set: `A, B`
- excluded assets: `C, D`

Excluded assets are removed from the current group resolution only.

They may later:

- appear together in a smaller candidate group
- appear in a different candidate group with other assets
- leave duplicate workflow entirely if no remaining candidate relationships exist

### Singleton Leftovers

If exclusions leave only one asset behind:

- no resolved duplicate group is created for that singleton
- the asset simply leaves the current group
- it is only revisited if it still has candidate relationships elsewhere

## Re-review Behavior

If a new candidate later connects to a previously resolved duplicate group:

- the earlier resolution remains visible as the current resolved state
- the group is marked `Needs Re-review`
- the user must explicitly review and confirm the updated group

Example:

1. `A, B, C, D` are reviewed and resolved.
2. Later, asset `F` is excluded from some other candidate group.
3. The remaining candidate evidence shows that `F` should be considered with the earlier resolved group.
4. Tedography should not silently merge `F` into the existing resolved duplicate set.
5. Instead, Tedography should create a re-review situation for that duplicate group.

## Relationship To The Existing Pair Review UI

The current pair-review UI remains useful and should remain available.

It is still appropriate for:

- pair-by-pair cleanup
- edge cases
- lower-level review of candidate relationships
- legacy continuity with existing reviewed data

The new duplicate-group UI is intended to become the preferred workflow for final duplicate-set resolution.

## New UI Surface

Suggested route:

- `/duplicates/groups`

This route should present a queue of provisional candidate groups rather than a queue of candidate pairs.

## Two Display Modes

The new duplicate-group UI should support two display modes.

These should be two views of the same underlying resolution state, not two separate workflows.

### Grid Mode

Grid mode is the overview mode.

Purpose:

- see the whole provisional group at once
- compare all members quickly
- classify assets efficiently

Expected characteristics:

- card/grid layout
- each asset visible at the same time
- quick actions for `Keeper`, `Duplicate`, `Not In This Group`
- good for understanding the entire candidate set

### Focus Mode

Focus mode is the careful inspection mode.

Purpose:

- inspect one asset at a time in a larger view
- compare details more carefully
- keep the same current keeper/duplicate/not-in-group decisions while switching presentation

Expected characteristics:

- larger image presentation
- viewport-dominant inspection
- next/previous asset navigation inside the same group
- all current classifications preserved when switching back to grid mode

## Per-Group UI Requirements

Each provisional group screen should show:

- group header
  - group size
  - unresolved / resolved / needs re-review state
  - any useful confidence or review summary
- asset cards/items
  - preview image
  - filename and basic metadata
  - current classification in this group
  - historical hint counts
- resolution controls
  - `Set as Keeper`
  - `Set as Duplicate`
  - `Remove From Group`
- completion summary
  - whether exactly one keeper is selected
  - whether all assets are explicitly classified
  - whether the group is ready to confirm

## Completion Rules

A provisional group is considered fully resolved only when:

- exactly one keeper is selected
- every other shown asset is explicitly marked either `Duplicate` or `Not In This Group`

If those conditions are not met:

- the group is still incomplete
- the user should not be told that the group is fully resolved

## Persisted Outcome

When the user confirms a group resolution:

- the resolved duplicate group is persisted with:
  - one keeper
  - zero or more duplicates
- excluded assets are removed from that resolved duplicate set
- Library duplicate behavior should reflect the resolved group
- historical pair-review data remains available for context

The new group UI’s final resolution is authoritative for duplicate-group behavior.

## Candidate Group Membership

Candidate-group membership is dynamic.

That means:

- an asset can begin in one provisional group
- later be excluded from that group
- and later appear again in a different provisional group if other candidate relationships still connect it elsewhere

This is expected behavior and not an error.

The system should therefore treat candidate groups as:

- review working sets
- not permanent identity containers

## Suggested User Messaging

Examples of user-facing concepts that should appear in the UI:

- `Keeper`
- `Duplicate`
- `Not In This Group`
- `Needs Re-review`
- `Historical duplicate review hints`
- `Resolved duplicate set`
- `Removed from this group`

Example result messaging:

- `Resolved duplicate set: 3 assets`
- `1 keeper, 2 duplicates`
- `2 assets removed from this group`
- `This group needs re-review because new candidate evidence was found`

## Non-Goals For The First Version

This first version should not try to do all duplicate maintenance tasks.

Do not include:

- fully automatic archive-wide regrouping after every action
- a giant duplicate-maintenance dashboard
- destructive bulk actions beyond the current duplicate concepts
- replacement of the existing pair-review UI
- overbuilt audit/history tooling

## Summary

The new duplicate-group UI should work like this:

1. Tedography derives provisional candidate groups from duplicate-candidate relationships.
2. The user reviews one group at a time.
3. The user chooses exactly one keeper.
4. Every other asset is explicitly classified as either:
   - duplicate
   - not in this group
5. The result becomes the authoritative resolved duplicate set for that group.
6. Excluded assets may later appear in other candidate groups if other candidate relationships still exist.
7. Previously resolved groups can later be marked `Needs Re-review` if new candidate evidence connects to them.

This creates a duplicate workflow that is more natural, more user-centered, and more aligned with the final “one keeper per resolved duplicate set” behavior Tedography needs in normal browsing.
