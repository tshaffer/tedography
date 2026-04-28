# People In Tedography

This guide explains what **People** means in Tedography and how to use it in normal day-to-day work.

It is a usage/reference document, not a technical design document.

## What People Is For

The People features in Tedography help you:

- identify who appears in photos
- review and correct face assignments
- find photos by person
- improve recognition quality over time
- maintain clean person records as the archive grows

People in Tedography is built around a simple idea:

- **confirmed people on an asset are the trusted result**

That trusted result is what shows up in the asset’s derived people list and what Search uses when you search by person.

## The Three Main People Concepts

There are three related but different concepts in Tedography:

### 1. Confirmed face detection

This means:

- a specific detected face in a specific photo has been confirmed as belonging to a person

### 2. Example face

This means:

- a confirmed face is also being used as an example to improve future recognition for that person

Not every confirmed face needs to become an example.

### 3. Asset people

This means:

- the confirmed people list for the whole photo

This is the trusted asset-level result used by People Search and by most “who is in this photo?” features.

## Where People Appears In Tedography

Tedography currently uses People in a few different places.

## Library

In `Library`, when one asset is selected and the right-side inspector is visible, the inspector shows a small **People** section.

This section can show:

- detections count
- reviewable count
- confirmed people
- actions to review faces for that asset

The top toolbar also supports people work in Library:

- `Run People Recognition` runs recognition for the current selected assets
- `People Scope` opens scoped people tools for the current Library selection or checked album scope

This is the quickest place to answer:

- has this photo been processed for people?
- are there still unresolved faces?
- who is already confirmed in this asset?

## Asset Review Dialog

From `Library`, `Review Faces` opens an asset-scoped people review dialog.

Use this when:

- you are already looking at one photo
- you want to fix people data without leaving Library

This is the best place to:

- confirm a suggested person
- reject a wrong suggestion
- assign an existing person
- create and assign a new person
- ignore a face
- add a confirmed face as an example

The dialog can also optionally show face boxes on the source image.

That helps answer:

- which face does this review card refer to?
- did the detector find the right face?
- which face is confirmed vs still reviewable?

The face-box overlay uses status colors for confirmed, suggested, auto-matched, unmatched, rejected, and ignored faces. The dialog also has an `Open Full People Review` link if the asset needs more queue-style work.

## People Review

The standalone People Review page is the queue/workbench view.

Use `/people/review` when you want to:

- work through many detections
- review unresolved faces across multiple assets
- use keyboard shortcuts and batch actions
- do broader cleanup work

This is more of a review queue than a browse page.

The current review queue supports:

- status filters for suggested, auto-matched, unmatched, confirmed, rejected, and ignored detections
- asset, person, and saved scoped-asset filters
- sorting by newest, confidence, filename, or asset id
- a secondary person-state filter within the loaded queue
- keyboard shortcuts: `J/K` or arrows to move, `C` confirm, `X` reject, `I` ignore, `A` focus assignment, `N` focus new-person creation
- batch `Confirm Selected`, `Reject Selected`, and `Ignore Selected`
- optional auto-advance after an action

By default, the general queue focuses on suggested, auto-matched, and unmatched faces. When opened for one asset, confirmed detections are included so you can inspect the whole asset state.

## People Browse

The People page at `/people` is the browse surface for known people.

Use it when you want to:

- browse people directly
- see who already has confirmed photos
- find people by display name
- sort by alphabetical, most assets, most recently seen, or needs review
- show or hide hidden/archived people
- jump into one person’s photos

People Browse cards show confirmed asset count, enrollment/example status, review-needed counts, last-seen date, and hidden/archived badges when applicable.

## Person Detail

Each person has a detail page.

Use it when you want to:

- see that person’s confirmed photos
- see example faces for that person
- rename, hide, or archive the person
- review related unresolved faces
- reprocess a bounded set of related assets
- do maintenance like merge, split, reassigning confirmed faces, or correcting mistakes

This is the main home for person-centered maintenance.

Current Person Detail maintenance includes:

- `View In Search`, which opens Search filtered to this person
- `Review Related Faces`, which opens People Review filtered to this person
- rename, hide, and archive controls
- merge into another person; the source person is hidden and archived after merge
- remove weak example faces
- add confirmed faces as examples
- remove a confirmed face from the person
- reassign a confirmed face to another person
- split selected confirmed faces into an existing person or a new person
- reprocess related assets; the current implementation processes up to 20 related assets at a time

## Search

Search can use confirmed people data to find photos.

Current people-related search modes include:

- selected people with `Any` match
- selected people with `All` match
- has no confirmed people
- has reviewable faces

This makes People useful for real retrieval, not just review.

Search people filters match confirmed derived `mediaAsset.people`. Reviewable faces are separate unresolved detections; they are only included when `Has reviewable faces` is selected.

## Initial Seeding For A Large Existing Library

If you already have a large library, such as tens of thousands of photos, do not try to seed People across the whole archive in one pass. Work in small, inspectable chunks so mistakes are easy to catch and recognition quality improves gradually.

Good starting scopes are:

- one small album
- one trip
- one year/month slice
- a small Library selection
- a Search result set with a clear date range

Avoid starting with a huge mixed scope. Large scopes make it harder to tell whether bad suggestions are caused by weak examples, look-alike people, poor face crops, or simply too much unreviewed data at once.

### Recommended First Pass

1. Pick a small, familiar scope.
2. Use `People Scope`.
3. Run `Run People Recognition` for that scope.
4. Open `Review Faces In Scope`.
5. Confirm only people you are confident about.
6. For important people, add a few clean confirmed faces as examples.
7. Reject wrong suggestions and ignore non-useful faces.
8. Return to the scope summary and check how many assets still have reviewable faces.

For early seeding, prefer precision over speed. A smaller number of correct confirmations and good examples is more useful than a large number of questionable confirmations.

### Building Example Sets

After confirming a person in a few photos, open that person from `/people` and inspect their detail page.

For each important person:

- add several clear, varied confirmed faces as examples
- prefer sharp, front-facing, well-lit faces
- include some variation over time when the person appears across many years
- remove weak examples if they are blurry, tiny, occluded, or belong to someone else

The `Not enrolled` badge means the person has confirmed photos but no example faces yet. A thin example set is expected early; improve it gradually as you review more scopes.

### Reprocess After Better Examples

Once you have better examples for a person, reprocess a related scope rather than the entire archive.

Useful reprocessing scopes include:

- the same album you just reviewed
- another album from the same event
- a date-range Search for the same trip or year
- the related assets shown on that person's detail page

Then review the new suggestions. If suggestions improve, continue with the next similar scope. If suggestions get worse, inspect the example faces before expanding further.

### Checks Along The Way

Use these checks after each chunk:

- In `People Review`, confirm the queue is getting smaller for the scope.
- In `Search`, filter by a person and spot-check that returned photos really contain that person.
- In `Search`, use `Has no confirmed people` to find photos that may still need work.
- In `Search`, use `Has reviewable faces` to find photos with unresolved detections.
- On a person detail page, check confirmed photos for obvious false positives.
- On a person detail page, check example faces before reprocessing more assets.
- In People Browse, sort by `Needs Review` to find people with remaining review work.

If you find a bad confirmation, fix it before continuing. Reassign or remove the confirmed face from the person detail page, then re-check the affected asset or scope.

### Suggested Chunk Size

There is no fixed best size, but a practical first approach is:

- start with 25-100 photos when creating initial examples
- move to one album or one date slice after examples look good
- use larger scopes only after Search spot-checks are consistently clean

The scoped tools can process larger sets, but review quality matters more than raw throughput during initial seeding.

### When To Move On

Move to the next chunk when:

- the main people in the current scope have a few confirmed faces
- important people have usable example faces
- Search spot-checks look correct
- remaining reviewable faces are either low value or intentionally deferred
- there are no obvious false positives in the person detail pages

This chunked approach lets People become useful quickly while keeping the long-term data trustworthy.

## Typical Everyday Workflow

For one photo:

1. Select a photo in `Library`
2. Run `Run People Recognition` if needed
3. Open `Review Faces`
4. Confirm, assign, reject, or ignore faces
5. Check the derived people result for the asset

For a person:

1. Open `/people`
2. Open a person
3. Check confirmed photos and example faces
4. Add or remove examples as needed
5. Reprocess related assets if recognition quality needs improvement

For a batch of work:

1. Use `People Review`
2. Work through the queue
3. Use status filters, person filters, shortcuts, batch actions, and auto-advance
4. Confirm enough faces to improve trusted person data

## Confirmed Vs Reviewable

This distinction is important.

### Confirmed

Confirmed means:

- Tedography trusts this person assignment for that face
- it can contribute to the asset’s derived people list

### Reviewable

Reviewable means:

- the face still needs user review
- it is not yet trusted as confirmed person data

Reviewable faces can include things like:

- suggested matches
- auto-matched candidates that still need confirmation
- unmatched faces

In short:

- **confirmed = trusted**
- **reviewable = still needs work**

## What “Not Enrolled” Means

A person can have confirmed photos but still be shown as:

- `Not enrolled`

That means Tedography knows who the person is in confirmed photos, but that person does not yet have example faces being used to improve recognition quality.

To improve recognition:

1. confirm a good face for that person
2. use `Add as Example`
3. optionally reprocess related assets

## Maintenance Work

As the archive grows, mistakes happen. Tedography supports maintenance workflows to correct them.

Current examples include:

- merge duplicate people
- split a person when some confirmed faces belong to someone else
- remove a bad example
- reassign a mistaken confirmed face
- remove a confirmed face from the wrong person

These tools are intended to keep long-term people data trustworthy.

## Scoped People Work

Tedography also supports scoped people work on subsets of the archive.

Depending on context, you can run people actions for:

- current Library selection
- checked album scope in Library albums mode
- current Search results
- Search date-range scope

This is useful when you want to work through:

- one album
- one trip
- one date slice
- one curated subset of assets

without trying to process the entire archive at once.

Open scoped people work with the `People Scope` toolbar button. The dialog shows a scoped summary:

- assets in scope
- assets with confirmed people
- assets without confirmed people
- assets with reviewable faces
- total reviewable detections

From there you can:

- run people recognition for the scope
- reprocess people recognition for the scope
- open `Review Faces In Scope`

Scoped review uses a saved browser session scope, so it is meant as a working-session tool rather than a permanent saved view.

## Hide Vs Archive

People records can currently be:

- hidden
- archived

Both are lightweight state flags rather than deletion.

Practical meaning today:

- **Hidden**
  - keep the person out of normal People Browse results unless `Show hidden people` is enabled
- **Archived**
  - keep the person record, but treat it as inactive in People Browse unless `Show archived people` is enabled

Neither one deletes the person or removes confirmed people from existing assets.

## What People Does Not Mean

People support in Tedography is useful, but it is important to keep expectations clear.

It does **not** mean:

- every face has already been reviewed
- every suggestion is correct
- every confirmed face is automatically an example
- every person record is perfectly clean forever

People data becomes trustworthy through:

- confirmation
- correction
- maintenance
- better examples over time

## Recommended Practical Habit

The simplest reliable habit is:

1. process a manageable scope
2. review unresolved faces
3. confirm the right people
4. add a few good examples for important people
5. reprocess related assets when recognition quality needs improvement
6. periodically merge/split/correct people records as needed

That keeps People useful for both:

- finding photos
- maintaining long-term correctness

## Related Docs

If you want more detailed workflow notes, see:

- [`PEOPLE_REVIEW_UI.md`](/Users/tedshaffer/Documents/Projects/tedography/Docs/PEOPLE_REVIEW_UI.md)
- [`PEOPLE_BROWSE.md`](/Users/tedshaffer/Documents/Projects/tedography/Docs/PEOPLE_BROWSE.md)
- [`PEOPLE_ENROLLMENT.md`](/Users/tedshaffer/Documents/Projects/tedography/Docs/PEOPLE_ENROLLMENT.md)
- [`PEOPLE_MAINTENANCE.md`](/Users/tedshaffer/Documents/Projects/tedography/Docs/PEOPLE_MAINTENANCE.md)
- [`PEOPLE_SEARCH.md`](/Users/tedshaffer/Documents/Projects/tedography/Docs/PEOPLE_SEARCH.md)
