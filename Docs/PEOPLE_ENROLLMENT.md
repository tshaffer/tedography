# People Enrollment And Recognition Quality

Tedography now includes lightweight enrollment and example-management tools for improving recognition quality over time.

## Core Concepts

Tedography now distinguishes between three related but different things:

1. **Confirmed detection**
   - this face in this photo is confirmed as belonging to a person

2. **Example / enrollment face**
   - this confirmed face is also being used to improve future recognition for that person

3. **Derived asset people**
   - the confirmed people on an asset, stored in `mediaAsset.people`

Not every confirmed face automatically becomes an example.

## Where To Manage Example Quality

### Person Detail

`/people/:personId` now shows:

- enrollment status
- example count
- example-face strip
- remove-example controls
- reprocess-related-assets action

This is the main place to understand whether a person is well enrolled.

### People Review

Confirmed detections now expose:

- `Add As Example`

This lets you promote a known-good confirmed face directly into the example set without leaving the normal review flow.

### Asset-Scoped Review Dialog

The Library review dialog also exposes:

- `Add As Example`

for confirmed detections, so in-context review can still improve recognition quality.

## Enrollment Status Meaning

The current UI uses simple, honest hints:

- `Not enrolled`
- `Enrolled: N examples`
- `Enrolled: N examples (thin set)`

`thin set` means Tedography currently has only a small number of active examples for that person.

This is a heuristic only. It is not a model-quality score.

## Add A New Example

Typical flow:

1. Confirm a face as belonging to a person
2. Click `Add As Example`
3. Tedography:
   - uses the face crop / isolated face
   - updates the active recognition engine enrollment
   - stores an explicit example record for that person

The action is idempotent for the same person + detection pair, so repeatedly clicking the same confirmed face does not create meaningless duplicate active examples.

## Remove A Bad Example

From Person Detail, each example face can be removed.

Removing an example:

- removes it from tedography's active example set
- updates Rekognition-backed enrollment state when supported
- does **not** erase the original confirmed detection or review history
- does **not** remove that person from confirmed asset metadata by itself

This keeps example quality management separate from asset truth/history.

## Reprocess After Enrollment Changes

Person Detail now includes:

- `Reprocess Related Assets`

This re-runs people recognition for a small explicit set of recent confirmed assets for that person, so you can improve examples and then quickly see whether recognition gets better.

This is intentionally scoped. It is not a full-library backfill tool.

## Rekognition Notes

At a high level, tedography continues to use Rekognition behind the existing provider-neutral abstraction:

- confirmed face crops are used as example inputs
- multiple examples can be associated with one person/user
- removing an example updates the stored enrollment set and the underlying Rekognition association when supported

The UI stays tedography-centric and does not require users to think in raw Rekognition terms.

## Typical Local Test Flow

1. Start API and web:

```bash
pnpm --filter @tedography/api dev
pnpm --filter @tedography/web dev
```

2. Open a confirmed detection in:

- `/people/review`
- or the Library asset-scoped people dialog

3. Click `Add As Example`
4. Open that person's detail page at `/people/:personId`
5. Verify:
   - example count increased
   - enrollment status changed
   - the example face appears in the example section
6. Optionally remove a weak example
7. Click `Reprocess Related Assets`
8. Re-open review/search results and inspect whether recognition quality improved

## Current Limitations

- Example ordering is still simple and not yet curated/pinned.
- Tedography does not yet expose a rich example-quality scoring system.
- This is not yet a full advanced enrollment-management console.
