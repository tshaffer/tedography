# People Maintenance

Tedography now includes a narrow Phase 9 maintenance slice focused on keeping person data correct over time.

## Scoped People Maintenance / Backfill v1

Tedography now also supports a small scoped people-maintenance workflow so you can work through a subset of the archive instead of the whole library.

Supported scope sources in this first version:

- current Library selection
- current Search results

Use the `People Scope` action from the main toolbar when:

- you have selected one or more assets in `Library`
- or you are viewing a filtered result set in `Search`

The scoped people dialog provides:

- a compact people-status summary for the current scope
- `Run People Recognition`
- `Reprocess People Recognition`
- `Review Faces In Scope`

Scoped summary counts include:

- total assets in scope
- assets with confirmed people
- assets without confirmed people
- assets with reviewable faces
- total reviewable detections

Semantics:

- confirmed people are based on derived `mediaAsset.people`
- reviewable faces are unresolved detections and stay separate until reviewed
- processing/reprocessing does not itself confirm anyone

`Review Faces In Scope` opens the standalone People Review page with that saved asset set as the current scope.

## Merge Duplicate People

Use `Merge Person` on a person detail page when two person records represent the same real person.

What merge does:

- the selected target person survives
- confirmed detections assigned to the source person are reassigned to the target person
- active example faces on the source person are moved to the target person when possible
- affected asset-level derived `mediaAsset.people` values are recomputed
- the source person is hidden and archived

What merge does not do:

- it does not delete the source person record
- it does not run a full-library reprocess
- it does not merge unrelated person metadata beyond the current practical scope

## Split Person v1

Use `Split Selected Faces` on Person Detail when a person record is mostly correct, but some confirmed faces actually belong to a different real person.

Flow:

1. Open a person detail page
2. In `Confirmed Faces`, select one or more faces
3. Click `Split Selected Faces`
4. Choose either:
   - an existing destination person
   - or a new person name
5. Confirm the move

What split does:

- selected confirmed detections move from the source person to the destination person
- affected assets recompute derived `mediaAsset.people`
- selected example faces move with those detections when they were already part of the source example set
- unselected confirmed faces stay on the source person

How split differs from merge:

- merge combines one whole person into another surviving person
- split moves only a selected subset of confirmed faces out of the current person

Split is the right tool when:

- the current person is mostly correct
- but a subset of confirmed faces belong to someone else

## Correct Mistaken Confirmed Assignments

On Person Detail, the `Confirmed Faces` section now supports:

- `Reassign`
- `Remove from Person`
- `Add as Example`

Use these when a confirmed face was assigned to the wrong person.

Semantics:

- confirmed detection:
  this face in this asset is confirmed as belonging to a person
- example face:
  this confirmed face is also being used to improve future recognition
- derived `mediaAsset.people`:
  the asset-level confirmed people list derived from confirmed detections

These are intentionally separate concepts.

Examples:

- removing an example does not by itself remove the confirmed detection
- removing a confirmed face from a person updates the derived asset people state
- reassigning a confirmed face removes stale example enrollment tied to the old person
- splitting selected faces moves only the chosen detections/examples, not the whole person

## Reprocess After Maintenance

Use `Reprocess Related Assets` on Person Detail after making significant example-set changes.

This is intentionally scoped:

- it reprocesses a small recent set of assets already confirmed for that person
- it does not launch a full-library reprocess

## Recommended Local Validation

1. Open `/people`
2. Open a person detail page
3. In `Confirmed Faces`, remove or reassign a mistaken detection
4. In `Example Faces`, remove a weak example if needed
5. Optionally add a better confirmed face as an example
6. If two people should be one, use `Merge Person`
7. Use `Reprocess Related Assets`
8. Re-open People Review or Search to inspect the updated state

For scoped maintenance / backfill:

1. In `Library`, select a manageable asset subset, or switch to `Search` and apply filters until the result set is the scope you want
2. Click `People Scope`
3. Inspect the scoped people summary
4. Click `Run People Recognition` or `Reprocess People Recognition`
5. Click `Review Faces In Scope`
6. Work through the resulting People Review queue

## Current Limitations

- merge is careful but still intentionally narrow
- there is no merge preview dashboard or full audit trail yet
- scoped maintenance is limited to current Library selection and current Search results
- scoped processing still iterates existing per-asset processing calls rather than a dedicated batch job
- there is no archive-wide reprocess tool in this phase
