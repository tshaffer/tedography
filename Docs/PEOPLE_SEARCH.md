# People Search

Tedography Search now includes a **People** section for finding assets using confirmed people metadata and unresolved face-review state.

## What The Filters Mean

People search uses two different concepts:

- **Confirmed people**
  - this is derived `mediaAsset.people`
  - it comes only from confirmed face-review results
- **Reviewable faces**
  - these are unresolved face detections
  - statuses:
    - `unmatched`
    - `suggested`
    - `autoMatched`

Confirmed people and reviewable faces are intentionally separate.

## Supported Searches

From `Search`, the `People` section supports:

- **Has person**
  - select one person
- **Has any of these people**
  - select multiple people
  - leave `Match` set to `Any`
- **Has all of these people**
  - select multiple people
  - set `Match` to `All`
- **Has no confirmed people**
  - assets with no confirmed derived people
- **Has reviewable faces**
  - assets that still have unresolved people-review work

## Typical Examples

- show me photos with Lori
  - select `Lori`
- show me Ted or Lori
  - select `Ted` and `Lori`
  - use `Match: Any`
- show me Ted and Lori together
  - select `Ted` and `Lori`
  - use `Match: All`
- show me photos with no people metadata yet
  - enable `Has no confirmed people`
- show me photos that still need people review
  - enable `Has reviewable faces`

## Notes

- Person filters operate on confirmed derived people only.
- `Has no confirmed people` clears any currently selected people.
- `Has reviewable faces` can be combined with person filters and other Search filters.
- Search filter state persists with the rest of Tedography’s local Search settings.

## Local Testing

1. Start API and web:

```bash
pnpm --filter @tedography/api dev
pnpm --filter @tedography/web dev
```

2. Open:

```text
http://localhost:3000/
```

3. Switch to `Search`.

4. In the `People` section:
   - select one or more people
   - switch `Match` between `Any` and `All`
   - try `Has no confirmed people`
   - try `Has reviewable faces`

5. Confirm the result set changes as expected and combines correctly with:
   - photo state filters
   - date range
   - album filters
