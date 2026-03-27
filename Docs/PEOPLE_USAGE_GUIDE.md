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

In `Library`, when one asset is selected, the inspector can show a small **People** section.

This section can show:

- detections count
- reviewable count
- confirmed people
- actions to review faces for that asset

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

## People Review

The standalone People Review page is the queue/workbench view.

Use `/people/review` when you want to:

- work through many detections
- review unresolved faces across multiple assets
- use keyboard shortcuts and batch actions
- do broader cleanup work

This is more of a review queue than a browse page.

## People Browse

The People page at `/people` is the browse surface for known people.

Use it when you want to:

- browse people directly
- see who already has confirmed photos
- sort/filter people
- jump into one person’s photos

## Person Detail

Each person has a detail page.

Use it when you want to:

- see that person’s confirmed photos
- see example faces for that person
- rename, hide, or archive the person
- review related unresolved faces
- reprocess related assets
- do maintenance like merge, split, or correcting mistakes

This is the main home for person-centered maintenance.

## Search

Search can use confirmed people data to find photos.

Current people-related search modes include:

- has one person
- has any of these people
- has all of these people
- has no confirmed people
- has reviewable faces

This makes People useful for real retrieval, not just review.

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
3. Use shortcuts, batch actions, and filters
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

## Hide Vs Archive

People records can currently be:

- hidden
- archived

Both are lightweight state flags rather than deletion.

Practical meaning today:

- **Hidden**
  - keep the person out of normal browsing/default views
- **Archived**
  - keep the person record, but treat it as inactive

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
