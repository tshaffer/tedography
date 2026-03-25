# People Pipeline Validation Workflow

This pass is focused on validating the real Rekognition-backed people pipeline on a small curated corpus.

## Goals

Use the existing tools to answer:

- are detections being created consistently?
- are faces being ignored for understandable reasons?
- are suggestions and auto-matches plausible enough for review?
- does enrollment improve later recognition?
- does derived `mediaAsset.people` only update after confirmed review actions?

## Main pages

- Dev harness: `http://localhost:3000/people/dev`
- Review queue: `http://localhost:3000/people/review`

## What is now visible

Both pages now expose more validation data.

### Dev harness

- active engine and pipeline version
- threshold values:
  - `minDetectionConfidence`
  - `minFaceAreaPercent`
  - `minCropWidthPx`
  - `minCropHeightPx`
  - `reviewThreshold`
  - `autoMatchThreshold`
- detection counts by status
- review decision counts
- recent asset cards with:
  - detection count
  - reviewable detection count
  - confirmed detection count
- `Load Asset State`
- `Process Recent 5`

### Review page

- status counts
- sorting options:
  - newest first
  - highest confidence
  - lowest confidence
  - filename
  - asset id
- face crop preview plus source asset thumbnail
- suggested confidence / match confidence
- derived `mediaAsset.people`

## Recommended validation sequence

1. Start the API with Rekognition enabled.
2. Open `/people/dev`.
3. Create sample people or create a few real target people.
4. Process one or a few known assets.
5. Inspect:
   - detection count
   - ignored reason
   - suggested person
   - suggested confidence
6. For a known-good detection:
   - `Assign Existing` or `Create + Assign`
   - then click `Enroll <person>`
7. Reprocess similar assets.
8. Open `/people/review`.
9. Sort by `Highest Confidence` and review:
   - `suggested`
   - `autoMatched`
   - `unmatched`
10. Confirm only true matches and verify derived `mediaAsset.people`.

## Status meanings

- `unmatched`
  - no candidate cleared the review threshold
- `suggested`
  - candidate cleared the review threshold but not the auto-match threshold
- `autoMatched`
  - candidate cleared the auto-match threshold, but is still not treated as confirmed truth
- `confirmed`
  - reviewer confirmed or assigned a person
- `rejected`
  - reviewer rejected the match
- `ignored`
  - detection was ignored either by heuristics or reviewer action

## Thresholds to tune

These are read from API config and shown in the dev harness:

- `TEDOGRAPHY_PEOPLE_PIPELINE_MIN_DETECTION_CONFIDENCE`
- `TEDOGRAPHY_PEOPLE_PIPELINE_MIN_FACE_AREA_PERCENT`
- `TEDOGRAPHY_PEOPLE_PIPELINE_MIN_CROP_WIDTH_PX`
- `TEDOGRAPHY_PEOPLE_PIPELINE_MIN_CROP_HEIGHT_PX`
- `TEDOGRAPHY_PEOPLE_PIPELINE_REVIEW_THRESHOLD`
- `TEDOGRAPHY_PEOPLE_PIPELINE_AUTO_MATCH_THRESHOLD`
- `TEDOGRAPHY_PEOPLE_PIPELINE_REKOGNITION_FACE_MATCH_THRESHOLD`

Suggested tuning mindset:

- if too many tiny/background faces appear, raise the size thresholds
- if too many weak suggestions appear, raise `REVIEW_THRESHOLD`
- if auto-matches feel too aggressive, raise `AUTO_MATCH_THRESHOLD`
- keep the conservative trust model: only confirmed matches populate derived asset people

## Current limitations

- enrollment state is still implicit, not shown as a durable per-person status
- this is still a small-corpus validation workflow, not a full archive backfill tool
- Rekognition quality depends heavily on the quality and variety of enrolled example faces
