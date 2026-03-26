# People Maintenance

Tedography now includes a narrow Phase 9 maintenance slice focused on keeping person data correct over time.

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

## Current Limitations

- merge is careful but still intentionally narrow
- there is no merge preview dashboard or full audit trail yet
- there is no split workflow yet
- there is no archive-wide reprocess tool in this phase
