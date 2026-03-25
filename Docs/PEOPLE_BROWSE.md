# People Browse

Tedography now includes a dedicated People browse page at:

- `/people`

## Purpose

This page gives People a proper browse surface without requiring the full Person Detail experience yet.

It is intended for:

- browsing known people directly
- seeing which people are already useful in the archive
- jumping quickly to photos containing one person

It is not the same thing as the standalone review queue.

## What The Page Shows

Each person card shows:

- display name
- confirmed asset count
- a representative asset thumbnail when available
- last-seen date when available
- optional review-needed badge when assets containing that person still have reviewable faces

Asset counts are based on confirmed asset-level people metadata, not unresolved suggestions.

## Sort And Filter Options

The page currently supports:

- name search
- alphabetical sort
- most assets sort
- most recently seen sort
- needs review sort
- show archived people
- show hidden people

## Click-Through Behavior

Clicking `View Photos` on a person card opens the main app at `/` and reuses the existing Search flow with that person pre-applied as a People filter.

In practice, that means:

- the app opens in `Search`
- the selected person is added to Search's confirmed-people filter
- the resulting asset list shows photos containing that person

This is intentionally a browse-to-results handoff, not a full Person Detail page.

## How This Differs From People Review

Use `/people` when you want to:

- browse known people
- sort/filter the people list
- jump to photos for one person

Use `/people/review` when you want to:

- work a queue of face detections
- confirm/reject/assign/ignore faces
- do higher-volume people-review work

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

4. Verify the People page lists known people with counts.
5. Use the name filter and sort selector.
6. Click `View Photos` for one person.
7. Confirm the main app opens Search with that person already applied.

## Current Limitations

- This is not yet a full Person Detail page.
- Representative imagery uses a representative confirmed asset thumbnail when available, otherwise a placeholder initial.
- Review-needed badges are asset-level hints, not raw per-face detection counts.
