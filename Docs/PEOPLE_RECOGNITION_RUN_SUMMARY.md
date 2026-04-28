# People Recognition Run Summary

After running people recognition on a selection or scope, Tedography shows a **People Recognition Run Summary** dialog that breaks down what happened and provides direct actions for reviewing the results.

---

## When It Appears

The summary dialog opens automatically after either of these two flows completes:

- **Library toolbar → Run People Recognition** — run against the current asset selection
- **People Scope dialog → Run People Recognition / Reprocess People Recognition** — run against a scope (album, selection, search results, date range)

If the run fails entirely (every asset threw an error), the dialog is not shown and the existing error notice is displayed instead.

---

## Summary Dialog Contents

### Header

The dialog title is **People Recognition Run Summary**.

The header shows three badges:

| Badge | Content |
|---|---|
| Scope | The scope type (e.g. `selected-assets`, `Album`, `Library selection`) |
| Scope label | The human-readable scope name (e.g. `2012 Hawaii`, `3 selected assets`) |
| Assets requested | Total number of assets submitted to the run |

---

### Results Section

Eight counts are shown, one per bucket:

| Label | Definition |
|---|---|
| **Assets processed** | Assets for which recognition ran and completed |
| **Faces detected** | Assets where recognition found one or more faces |
| **Suggested matches** | Assets with at least one face whose `matchStatus` is `suggested` or `autoMatched` — these need human review |
| **Confirmed people** | Assets with at least one face whose `matchStatus` is `confirmed` |
| **Unmatched faces** | Assets with at least one face whose `matchStatus` is `unmatched` — detected but not matched to anyone |
| **Ignored faces** | Assets with at least one face whose `matchStatus` is `ignored` — detected but filtered out by quality/size thresholds |
| **No faces detected** | Assets where recognition ran and found zero faces — distinct from not processed |
| **Failed** | Assets where the recognition API call threw an error — shown in red when non-zero |
| **Not processed** | Assets where the engine skipped processing (e.g. already processed and `force` was not set) |

**Important distinctions:**

- *No faces detected* ≠ *Not processed*. "No faces" means the engine ran and returned an empty result. "Not processed" means the engine did not run at all.
- An asset can appear in more than one of the Suggested / Confirmed / Unmatched / Ignored buckets if it has multiple faces in different states.
- An asset with only ignored faces will appear in both **Faces detected** and **Ignored faces** but not in Unmatched, Suggested, or Confirmed.
- Failed assets are excluded from all other buckets.

---

### Review Next Section

Four action buttons are provided. Buttons are disabled and shown with reduced opacity when their bucket is empty.

| Button | Behaviour |
|---|---|
| **Review Suggested Matches (n)** | Navigates to the People Review page scoped to the suggested-match assets |
| **Review Unmatched Faces (n)** | Navigates to the People Review page scoped to the unmatched-face assets |
| **Review Ignored Faces (n)** | Navigates to the People Review page scoped to assets with ignored faces, where assignments can be made |
| **Show No-Face Assets (n)** | Closes the dialog and selects the no-face assets in the current grid |
| **Show Failed Assets (n)** | Closes the dialog and selects the failed assets in the current grid |
| **Return to Album** | Closes and dismisses the dialog |

---

## Returning to the Summary After Navigating Away

The run summary persists across navigation. If you click **Review Suggested Matches** or **Review Unmatched Faces**, the dialog saves itself to session storage before navigating to the People Review page. When you return to the library (`/`), the summary dialog reappears automatically so you can access the remaining bucket actions.

The summary is cleared only when explicitly dismissed:

- clicking **Done** (top-right of the dialog)
- clicking **Return to Album**
- clicking **Show No-Face Assets** or **Show Failed Assets** (these select assets and then dismiss)

Closing the browser tab or ending the session clears session storage and the summary with it.

---

## Bucket Semantics Reference

The bucket definitions use `matchStatus` values from the `FaceDetection` domain entity:

| `matchStatus` value | Meaning |
|---|---|
| `unmatched` | Face detected; no person assigned or suggested |
| `suggested` | Engine found a candidate person match — needs review |
| `autoMatched` | Engine auto-matched above the auto-match threshold — needs review |
| `confirmed` | Assignment confirmed by a human reviewer |
| `rejected` | Suggested match was rejected by a human reviewer |
| `ignored` | Face filtered out (too small, low quality, background, etc.) — counted in the Ignored Faces bucket |

Ignored faces have their own bucket and action. They are not counted as unmatched (no person was attempted) but they were detected, so they are still accessible for manual review and assignment via **Review Ignored Faces**.

---

## Implementation Notes

- The summary is **computed frontend-side** from the array of `ProcessPeopleAssetResponse` objects returned by the parallel per-asset `processPeopleAsset()` calls. No new backend endpoint is required.
- The shared type is `PeopleRecognitionRunSummary` in `packages/shared/src/api/peoplePipeline.ts`.
- The dialog component is `PeopleRecognitionRunSummaryDialog` in `apps/web/src/components/people/`.
- Session storage key: `tedography.people.runSummary`.
- The `computePeopleRunSummary` function in `App.tsx` maps `PromiseSettledResult[]` to the summary by index, preserving the correspondence between `requestedAssetIds` and results.

---

## Current Limitations

- The summary reflects the state of detections at the moment the run completes. If detections are reviewed or updated after the run, the summary counts are not updated — dismiss and re-run to get fresh counts.
- The summary covers one run at a time. There is no run history UI in this phase.
- For large runs, asset IDs for all buckets are held in memory and session storage. Pagination or a persisted run model is deferred to a later phase.
- **Show No-Face Assets** and **Show Failed Assets** select assets in the current grid view. If those assets are not visible in the current area or filter state, they will be selected but not immediately visible — adjust the area or photo state filter if needed.
