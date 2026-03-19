# Tedography Duplicate UI

This document describes the duplicate-related user interface currently implemented in Tedography.

It covers:

- pair review
- duplicate group review and canonical selection
- duplicate action planning
- controlled execution of approved action plans
- how confirmed duplicate resolutions affect the main app

It does not describe backend internals except where they affect visible UI behavior.

## 1. Entry Points

There are four main UI surfaces related to duplicates:

1. Main app browsing and asset inspection at `/`
2. Duplicate pair review at `/duplicates/review`
3. Duplicate group review and canonical resolution at `/duplicates/groups`
4. Duplicate action planning at `/duplicates/plans`

## 2. Main App Duplicate UI

Phase 6 made confirmed duplicate resolutions visible in the normal browsing experience.

### 2.1 Default Visibility Behavior

In the main app:

- canonical assets from confirmed duplicate groups remain visible by default
- non-canonical members of confirmed duplicate groups are suppressed by default
- unresolved or merely proposed groups do not suppress assets

This behavior is non-destructive. Suppressed assets still exist and can be revealed again.

### 2.2 Reveal Control

In the main toolbar, under `View Options`, there is a checkbox:

- `Show suppressed duplicates`

Behavior:

- unchecked: hide confirmed non-canonical duplicates
- checked: show them again

This preference is persisted in local storage.

### 2.3 Grid / Thumbnail Indicators

When an asset belongs to a confirmed duplicate group, the asset card can show:

- `Keeper` for the selected canonical asset
- `Duplicate` for a revealed non-canonical member

These are badges on the asset card in the main browsing UI.

### 2.4 Asset Inspector / Details

When a selected asset belongs to a confirmed duplicate group, the inspector shows duplicate context:

- duplicate role
- duplicate group key
- link or action to open the duplicate group page

In the asset details panel there is an `Open Duplicate Group` action.

## 3. Duplicate Pair Review UI

Route:

- `/duplicates/review`

Purpose:

- review candidate pairs one pair at a time
- decide whether a pair is actually a duplicate pair
- inspect scoring context and image metadata

Important:

- this page does not choose which asset to keep
- it only records the human judgment for the pair

### 3.1 Pair Review Filters

The pair review page includes a `Queue Filters` section with:

- `Status`
  - `unreviewed`
  - `reviewed`
  - `ignored`
  - `all`
- `Classification`
  - `very_likely_duplicate`
  - `possible_duplicate`
  - `similar_image`
  - `all`
- `Outcome`
  - `none`
  - `confirmed_duplicate`
  - `not_duplicate`
  - `ignored`
  - `all`
- `Asset ID`
- `High confidence only (score >= 0.90)`

Actions:

- `Apply Filters`
- `Reset Filters`
- `Refresh Queue`

The applied pair-review filters are persisted in local storage.

### 3.2 Pair Review Summary / Progress

The page shows summary cards such as:

- matching pairs
- unreviewed
- reviewed
- confirmed duplicate
- remaining loaded
- high confidence
- no outcome

The current pair header also shows position:

- `Position X of Y`

If only the first chunk is loaded, it indicates that as well.

### 3.3 Pair Comparison Area

The current pair view shows:

- Asset A image
- Asset B image
- filename
- asset id
- original archive path
- capture time if available
- dimensions if available

It also shows pair-level metadata:

- score
- classification
- status
- outcome
- analysis version
- generation version

And scoring/debug signals:

- `dHashDistance`
- `pHashDistance`
- `dimensionsSimilarity`
- `aspectRatioDelta`
- `sourceUpdatedTimeDeltaMs`

### 3.4 Pair Review Actions

Primary actions:

- `Duplicate`
- `Not Duplicate`
- `Ignore`
- `Previous`
- `Next`

Bulk action:

- `Bulk Ignore Loaded (N)`

`Bulk Ignore Loaded` applies to the currently loaded filtered queue, not to hidden/unloaded results.

### 3.5 Pair Review Keyboard Shortcuts

Supported shortcuts:

- `D` = Duplicate
- `N` = Not Duplicate
- `I` = Ignore
- `Right Arrow` or `J` = Next
- `Left Arrow` or `K` = Previous

### 3.6 Derived Duplicate Groups Preview

The pair review page also includes a lightweight derived-groups section.

It can show:

- number of duplicate groups
- total assets across those groups
- a short preview of a few groups

This is primarily a bridge into the group review flow.

## 4. Duplicate Group Review UI

Route:

- `/duplicates/groups`

Purpose:

- review connected duplicate groups derived from confirmed duplicate pair outcomes
- inspect the proposed canonical asset
- override the canonical choice if needed
- confirm the resolution

This is where the user chooses the keeper.

## 5. Group Filters / Queue Slicing

The duplicate groups page includes `Group Filters`.

Controls:

- `Resolution Status`
  - `all`
  - `proposed`
  - `confirmed`
- `Group Size`
  - `all`
  - `exactly 2 members`
  - `3+ members`
- `Sort`
  - `unresolved first`
  - `smallest first`
  - `largest first`
- `Asset ID`
- `Only show groups ready for bulk confirm`

Actions:

- `Apply Filters`
- `Reset Filters`
- `Refresh`

The applied group filters are persisted in local storage.

## 6. Group Summary / Progress

The groups page shows summary cards for the current filtered queue, including:

- filtered groups
- proposed
- confirmed
- ready to confirm
- exactly 2 assets

Within the group detail area, the current group also shows:

- resolution status
- current position in the filtered queue

Example:

- `Status: proposed, Position 4 of 18`

## 7. Group List Sidebar

The left sidebar lists the currently filtered groups.

Each list item shows:

- group key
- asset count
- resolution status
- selected canonical filename or asset id
- `Ready to bulk confirm` when applicable

Selecting a group opens its detail panel on the right.

## 8. Group Detail View

For the selected group, the detail pane shows:

- group key
- asset count
- confirmed pair-link count
- proposed canonical asset id
- canonical reason summary
- selected canonical asset id
- list of non-canonical members

Each group member card shows:

- image preview
- filename
- asset id
- original path
- capture time
- dimensions
- original format
- display storage type
- photo state
- file size
- radio button for `Use as canonical`

Per-member labels:

- `Proposed canonical`
- `Manual override`

## 9. Group Actions

Per-group actions:

- `Save Canonical Selection`
- `Confirm Resolution`
- `Reset To Proposed`
- `Previous Group`
- `Next Group`

Behavior:

- `Save Canonical Selection`
  - saves the selected canonical choice
  - leaves the group in `proposed` status
  - does not activate suppression in the main app
- `Confirm Resolution`
  - saves the selected canonical choice
  - marks the group `confirmed`
  - activates canonical/suppressed behavior in the main app
- `Reset To Proposed`
  - clears a manual override
  - restores the proposed canonical choice
  - sets status back to `proposed`

## 10. Bulk Group Action

The groups page includes:

- `Bulk Confirm Proposals (N)`

This acts on the explicit currently filtered set of groups that are:

- still `proposed`
- still using the proposed canonical asset

It does not override manual selections.

This is intended as the main throughput improvement for large duplicate-resolution backlogs.

## 11. Group Keyboard Shortcuts

Supported shortcuts on the groups page:

- `S` = Save Canonical Selection
- `C` = Confirm Resolution
- `R` = Reset To Proposed
- `Right Arrow` or `J` = Next Group
- `Left Arrow` or `K` = Previous Group

Shortcuts do not fire while typing into inputs.

## 12. Duplicate Action Planning And Execution UI

Route:

- `/duplicates/plans`

Purpose:

- generate planning-only archive actions for confirmed duplicate groups
- inspect proposed actions before any execution exists
- review plans as `approved`, `rejected`, or `needs_manual_review`
- export a dry-run JSON manifest
- execute approved plans in a controlled way
- inspect execution history and retry failed items

Important:

- this page now includes a real operation path
- the real operation is limited to quarantine moves for approved secondary duplicates
- it still does not permanently delete files
- it still does not perform metadata merge/reconciliation

### 12.1 Planning Eligibility

The action-planning UI works only from sufficiently settled duplicate groups.

In practice:

- confirmed duplicate groups can produce plans
- unresolved or merely proposed groups do not produce plans
- ambiguous confirmed groups are blocked into manual review rather than receiving an executable-looking plan

### 12.1a Execution Eligibility

Real execution is only available when the plan is in a safe executable state.

In practice, a plan must be:

- `approved`
- `eligible_for_future_execution`
- tied to a currently confirmed duplicate group
- still aligned with the current canonical asset choice
- not already successfully executed

If these conditions are not met, execution is blocked.

### 12.2 Plan Filters

The page includes filters for:

- `Plan Status`
  - `all`
  - `proposed`
  - `needs_manual_review`
  - `approved`
  - `rejected`
- `Primary Action`
  - `all`
  - `PROPOSE_ARCHIVE_SECONDARY`
  - `NEEDS_MANUAL_REVIEW`
  - `KEEP_CANONICAL`
- `Asset ID`

Actions:

- `Apply Filters`
- `Reset Filters`
- `Refresh`

### 12.3 Plan Generation / Export / Warning State

The page includes plan-generation controls:

- `Only generate missing plans`
- `Generate Plans`
- `Export JSON Manifest`

Behavior:

- `Generate Plans` derives plans from currently confirmed duplicate groups
- `Only generate missing plans` avoids regenerating already persisted plan rows
- `Export JSON Manifest` downloads a dry-run JSON report for the currently filtered plan set

The page also shows a prominent warning that execution from this screen performs real filesystem moves into quarantine.

### 12.4 Plan Summary / Progress

The page shows summary cards such as:

- plans
- proposed
- needs manual review
- approved
- eligible later

These summarize the currently filtered set of action plans.

### 12.5 Plan List Sidebar

The left sidebar lists filtered plans.

Each row shows:

- group key
- plan status
- primary action type
- canonical filename or asset id

Selecting a row opens the plan detail panel.

### 12.6 Plan Detail View

The plan detail view shows:

- group key
- plan status
- execution readiness
- rationale
- canonical asset
- secondary assets
- per-asset action items
- review note
- execution history
- per-item execution result details

For safe plans, the typical pattern is:

- canonical asset action: `KEEP_CANONICAL`
- secondary asset action: `PROPOSE_ARCHIVE_SECONDARY`

For blocked plans, the primary action is:

- `NEEDS_MANUAL_REVIEW`

### 12.7 Plan Review Actions

The page supports lightweight review actions:

- `Approve`
- `Reject`
- `Mark Needs Manual Review`

Behavior:

- `Approve`
  - marks the plan as reviewed/approved
  - is only allowed for plans whose readiness is `eligible_for_future_execution`
- `Reject`
  - marks the plan rejected
- `Mark Needs Manual Review`
  - explicitly sets the plan status to manual-review state

### 12.7a Plan Execution Actions

The page also supports real execution actions:

- `Execute Quarantine Move`
- `Retry Failed Items`

Behavior:

- `Execute Quarantine Move`
  - only enabled for approved plans with execution readiness `eligible_for_future_execution`
  - shows a confirmation dialog first
  - performs real filesystem moves for secondary duplicate assets
  - moves secondaries into a quarantine/staging path instead of deleting them
- `Retry Failed Items`
  - only enabled when the most recent execution ended in `failed` or `partially_failed`
  - retries only the failed or skipped items from that execution

### 12.7b Execution History

For each plan, the page shows execution history entries including:

- execution id
- execution status
- succeeded / failed / skipped counts
- started time
- completed time
- per-asset source path
- per-asset quarantine destination path
- per-item error details when failures occur

This is intended to make the real operation path auditable and inspectable.

### 12.8 Safety / Explanation Behavior

Plans are intentionally conservative.

Examples of conditions that push a plan into blocked/manual-review behavior:

- missing original archive path on canonical or secondary assets
- suspicious or incomplete group structure
- mixed media-type group membership

The UI exposes this through:

- `planStatus`
- `executionReadiness`
- human-readable rationale strings

### 12.9 Current Executable Operation

The only real operation currently implemented is:

- move approved secondary duplicate files to quarantine

This is intentionally conservative.

There is currently no:

- permanent deletion
- archive merge
- metadata reconciliation
- automatic restore workflow

## 13. Relationship Between Pair Review, Group Review, Action Planning, And Execution

The intended user flow is:

1. Review pairs in `/duplicates/review`
2. Mark true duplicates as `Duplicate`
3. Tedography derives connected duplicate groups from confirmed duplicate pair relationships
4. Open `/duplicates/groups`
5. Confirm or override canonical selection
6. Once a group is confirmed, the main app begins suppressing non-canonical duplicates by default
7. Open `/duplicates/plans`
8. Generate planning-only archive actions for confirmed groups
9. Review, approve, reject, or export those plans
10. For approved eligible plans, deliberately execute quarantine moves
11. Review execution history and retry failed items if needed

This keeps duplicate truth, keeper selection, action planning, and real execution as separate stages.

## 14. Current Limitations

As implemented so far:

- pair review and group review are separate flows
- pair review does not choose a keeper
- group review works on derived groups, not persisted clusters
- suppression only applies to confirmed groups
- bulk pair cleanup is currently limited to `Bulk Ignore Loaded`
- export is currently JSON only
- the only real duplicate operation currently implemented is quarantine move
- there is still no permanent deletion, merge, or archive reconciliation flow

## 15. Short User Summary

If a user asks what duplicate UI currently exists, the short answer is:

- Pair review page to decide whether a pair is duplicate or not
- Group review page to choose and confirm the keeper
- Action plans page to generate, approve, export, and execute quarantine plans for confirmed duplicate groups
- Main app suppression of confirmed non-canonical duplicates
- Reveal toggle for suppressed duplicates
- Duplicate badges and duplicate-group links in the main app
