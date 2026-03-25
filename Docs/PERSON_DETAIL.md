# Person Detail

Tedography now includes a person detail page at:

- `/people/:personId`

## Purpose

This page gives each person a real home in tedography without yet building the full later-phase person-management system.

It is intended for:

- understanding one person’s confirmed presence in the archive
- seeing confirmed photos for that person
- checking whether related people-review work still needs attention
- doing lightweight person management such as rename / hide / archive

## What The Page Shows

At minimum, the page shows:

- display name
- representative image or placeholder
- confirmed asset count
- last seen date
- review-needed count
- confirmed photos containing that person
- a small example-face strip from confirmed detections when available

Confirmed photos are based on derived `mediaAsset.people`, not unresolved face suggestions.

## Review-Needed Semantics

The page keeps confirmed presence separate from unresolved work:

- confirmed photos come from confirmed derived asset people
- the `Needs Review` section is a summary of assets/detections that still need people review work related to this person

That means the page does not imply that every possible appearance of a person has already been confirmed.

## Management Actions

The current page supports lightweight person management:

- rename display name
- hide / unhide
- archive / unarchive

It does not yet support:

- merge / split
- advanced enrollment management
- representative-image curation

## Browse Click-Through

People Browse cards now open the person detail page first.

From there, the page provides:

- `View In Search`
- `Review Related Faces`

So the drill-in flow is now:

1. `/people`
2. `/people/:personId`
3. optional jump to Search or People Review

## Typical Local Test Flow

1. Start the API:

```bash
pnpm --filter @tedography/api dev
```

2. Start the web app:

```bash
pnpm --filter @tedography/web dev
```

3. Open:

```text
http://localhost:3000/people
```

4. Click one person card.
5. Verify the person detail page loads with:
   - header
   - confirmed counts
   - confirmed photo grid
   - needs-review section
6. Rename the person or toggle hide/archive.
7. Use `View In Search` to open existing search results for that person.
8. Use `Review Related Faces` to open the standalone review queue filtered to that person.

## Current Limitations

- This is not yet the full person-management experience.
- Example faces are derived from confirmed face detections, not a dedicated enrollment-example store.
- The review handoff is still the standalone queue page rather than an embedded per-person review surface.
