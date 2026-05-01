# Tedography — Implementation Gaps

> Comparison of documentation and plans against current code. Items ordered by estimated practical value.
> Generated 2026-04-30.

---

## 1. Duplicate Review UI (main app)

**Status:** Not implemented in main app  
**Docs:** `near-duplicate-detection-v1.md`, `DUPLICATE_UI.md`, `DUPLICATE_GROUP_UI_SPEC.md`, `DUPLICATE_GROUP_UI_IMPLEMENTATION_PLAN.md`

The near-duplicate detection backend is complete through Phase 2: perceptual hashes (dHash, pHash) are computed and stored, candidate pairs are generated and persisted, and a CLI exists for scanning and inspecting. The `DUPLICATE_UI.md` doc describes two routes as if they exist — `/duplicates/groups` and `/duplicates/review` — but neither is present in the main web app (`apps/web/src/main.tsx`). The separate `apps/duplicate-review-web` app exists but is a stub.

**What's missing:**
- Route `/duplicates/groups` — group-based review UI (select keeper, mark others as duplicates)
- Route `/duplicates/review` — pair-by-pair low-level review UI
- Any entry point to these flows from the main Library or toolbar

**Why it matters:** If duplicates have accumulated in the archive, there is currently no way to review and resolve them from within the app. The detection groundwork is done; the UI is the remaining blocker.

---

## 2. Keyword Backfill (applying keywords to existing assets)

**Status:** Data prep done, no tool  
**Docs:** `KeywordTreeProposal.txt`, `tedography_album_label_keyword_backfill_plan.json`, `tedography_album_label_to_keyword_mapping.json`, `tedography_recommended_keyword_tree.json`

A proposed keyword hierarchy has been designed and a detailed album-label → keyword mapping table has been compiled. The keyword CRUD infrastructure exists. But there is no import script, maintenance tool, or UI workflow to actually apply keywords to existing assets in bulk based on their album memberships.

**What's missing:**
- A backfill script or maintenance dialog to: (a) create the recommended keyword tree from `tedography_recommended_keyword_tree.json`, and (b) add keywords to assets based on the album-label mapping in `tedography_album_label_to_keyword_mapping.json`
- Alternatively, a UI-driven "Assign keyword to all assets in album" bulk action

**Why it matters:** The keyword hierarchy is only valuable if assets carry keywords. Without a backfill, older assets have none and Search/Smart Albums over keywords find nothing for them.

---

## 3. Face Overlay in Standalone People Review

**Status:** Partially implemented  
**Docs:** `TEDOGRAPHY_PEOPLE_REMAINING_ITEMS_EXPLAINED.md` (Phase 7)

Face boxes are implemented in the asset-scoped Library review modal with selection linking. They are **not** available in the standalone People Review page (`/people/review`), which is the higher-volume review surface.

**What's missing:**
- A preview area on the standalone review page showing the source photo with the face box highlighted for the currently selected detection
- Optionally: a "Show Face" toggle consistent with the Library modal behavior

**Why it matters:** When working through a long review queue on the standalone page, you currently have no visual confirmation of where the face appeared on the photo. This is the most used review surface for large queues.

---

## 4. Face Overlay in Person Detail

**Status:** Not implemented  
**Docs:** `TEDOGRAPHY_PEOPLE_REMAINING_ITEMS_EXPLAINED.md` (Phase 7)

No face box overlay exists on the Person Detail page (`/people/:personId`). Example face thumbnails are shown, but there is no way to see which face within the original photo was selected.

**What's missing:**
- Toggle mode on the example face strip to show the detection box overlaid on the source photo crop
- Optionally on confirmed photos: hover-reveal of which detected face maps to this person

**Why it matters:** Useful when verifying or cleaning up examples — especially for group shots where multiple people are present.

---

## 5. Person Management Enhancements

**Status:** Not implemented  
**Docs:** `TEDOGRAPHY_PEOPLE_REMAINING_ITEMS_EXPLAINED.md` (section 5), `TEDOGRAPHY_PEOPLE_ROADMAP_DONE_VS_REMAINING.md`

The current Person entity has `aliases?: string[]` and `notes?: string | null` defined in the domain model, and `sortName` is also a domain field — but none of these are exposed in the UI (confirmed by searching `PersonDetailPage.tsx`). Representative image selection is also missing.

**What's missing:**
- Aliases field on Person Detail (e.g. "Grandma" / "Ruth")
- Notes field (free-text disambiguation context)
- "Choose representative image" action to override the auto-selected thumbnail
- sortName editing (for controlling alphabetical order independently of display name)

**Why it matters:** Once the archive is large with many known people, disambiguation and representative image quality become noticeably important for daily use.

---

## 6. Enrollment / Example Quality Management

**Status:** Not implemented  
**Docs:** `TEDOGRAPHY_PEOPLE_REMAINING_ITEMS_EXPLAINED.md` (section 4), `TEDOGRAPHY_PEOPLE_ROADMAP_DONE_VS_REMAINING.md`

Examples can be added and removed from Person Detail, but there are no tools to reason about example quality.

**What's missing:**
- Pinned/starred "best example" designation
- Detection of near-duplicate examples ("all examples are from the same shoot")
- Quality hints like "thin set" or "no variation in angle/lighting"
- Sorting or ranking of examples by quality
- Diversity guidance

**Why it matters:** Recognition quality degrades when example sets are noisy, redundant, or unvaried. Without quality feedback, improving recognition requires guesswork.

---

## 7. People as a Full Curation Dimension (Phase 8 depth)

**Status:** Partially implemented  
**Docs:** `TEDOGRAPHY_PEOPLE_REMAINING_ITEMS_EXPLAINED.md` (section 2), `TEDOGRAPHY_PEOPLE_UI_ROADMAP.md`

People+date and People+keyword filters in Smart Albums were just implemented (this session). The search pipeline supports People+state. However, richer curation combinations remain mostly unpolished:

**What's missing:**
- People + Album as a Search combination (e.g. "show me assets with Lori from the Portugal 2025 album")
- People + camera/lens metadata combinations
- Saved "people-aware" presets beyond what Smart Albums currently support
- Richer cross-filter summaries (e.g. "2 people · 1 keyword · Keep")

**Why it matters:** This is where People stops being a lookup dimension and becomes a real part of how you explore the archive. The foundation is there; these are the high-value combinations.

---

## 8. Person Detail Deepening

**Status:** Partially implemented  
**Docs:** `TEDOGRAPHY_PEOPLE_REMAINING_ITEMS_EXPLAINED.md` (section 6), `PERSON_DETAIL.md`

The Person Detail page is functional but relatively lightweight.

**What's missing:**
- Solo vs. group distinction in the confirmed photos grid (filter to "this person alone" vs "this person + others")
- Recent appearances section (most recently confirmed photos, useful for monitoring pipeline quality over time)
- Embedded review queue scoped to this person (instead of navigating away to the standalone review page)
- Timeline/date grouping within Person Detail

**Why it matters:** For people you care about most, Person Detail could become a primary working surface rather than just a summary page.

---

## 9. People Review Page Refinements

**Status:** Partially implemented  
**Docs:** `TEDOGRAPHY_PEOPLE_REMAINING_ITEMS_EXPLAINED.md` (section 7), `TEDOGRAPHY_PEOPLE_UI_ROADMAP.md` (Phase 5)

Keyboard shortcuts, batch actions, recent-people helpers, and auto-advance are implemented. The remaining productivity work:

**What's missing:**
- Queue progress indicator (e.g. "47 of 312 reviewed in this session / scope")
- Stronger shared UI between the Library modal review and the standalone review page (they currently diverge in layout and behavior)
- More advanced scoped review modes (scope by date range, by album, by recognition confidence tier)
- Richer sort options (highest/lowest confidence, by person)

**Why it matters:** At high queue volumes, progress visibility and scope focus significantly affect review ergonomics.

---

## 10. Broader Operational Maintenance Workflows

**Status:** Not implemented  
**Docs:** `TEDOGRAPHY_PEOPLE_REMAINING_ITEMS_EXPLAINED.md` (sections 3 and 8), `TEDOGRAPHY_PEOPLE_ROADMAP_DONE_VS_REMAINING.md`

The current scoped maintenance tools are functional for one-off operations. Multi-session or recurring maintenance is not supported.

**What's missing:**
- Reusable named scopes (e.g. "2025 imports") saved across sessions
- Run history / audit log for maintenance operations
- Resumable scope workflows (start a large scope job, close the app, continue later)
- Background-style progress for larger scoped jobs

**Why it matters:** As the archive grows, people maintenance becomes ongoing rather than occasional. Without operational memory, repeated scoped work requires manual reconstruction each session.

---

## 11. `published` Field (SearchSpec vs MediaAsset Mismatch)

**Status:** Stub only  
**Docs:** `packages/domain/src/types/SearchSpec.ts` defines `published?: boolean`

The `SearchSpec` type has a `published` field, but the `MediaAsset` entity has no `published` field, and the asset repository has no corresponding filter logic. This field is defined in the type but has no implementation.

**What's missing:**
- `published` field on `MediaAsset`
- Mongoose schema field
- Repository query logic
- UI control in Search

**Why it matters:** Low urgency — this appears to be a placeholder for a future publication/sharing workflow. It doesn't block anything today but is a dormant inconsistency.

---

## Summary Table

| # | Feature | Doc Status | Code Status |
|---|---------|-----------|-------------|
| 1 | Duplicate review UI (main app) | Fully documented | Not implemented |
| 2 | Keyword backfill from album labels | Data prepared | No script/tool |
| 3 | Face overlay in standalone review | Documented | Not implemented |
| 4 | Face overlay in Person Detail | Documented | Not implemented |
| 5 | Person aliases, notes, representative image | Documented | Not implemented |
| 6 | Enrollment/example quality tools | Documented | Not implemented |
| 7 | Richer People+Album/camera curation | Documented | Partially done |
| 8 | Person Detail deepening | Documented | Partially done |
| 9 | Review page refinements | Documented | Partially done |
| 10 | Operational maintenance workflows | Documented | Not implemented |
| 11 | `published` search field | Type defined | No implementation |

---

## Note on Documentation Accuracy

`DUPLICATE_UI.md` describes `/duplicates/groups` and `/duplicates/review` routes as if currently live — they are not in the main app. This document should be updated to reflect that the duplicate backend exists but the review UI remains unbuilt.

`PERSON_DETAIL.md` (dated March 25) states that merge and split are not yet supported. Both have since been implemented in `PersonDetailPage.tsx`.
