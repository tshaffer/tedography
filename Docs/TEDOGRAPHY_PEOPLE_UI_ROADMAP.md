# Tedography People UI Roadmap

## Guiding principles

1. People is a **metadata dimension**, not the center of the app.
2. The default experience should stay **photo-first**.
3. Only **confirmed** people should be treated as durable asset metadata.
4. Face-level tooling and asset-level metadata should stay related but distinct.
5. Roll out in stages, with each stage becoming genuinely useful before adding more.

---

## Phase 1 — Practical Validation UI
**Goal:** make People usable enough to validate the pipeline on real photos.

### Primary surfaces
1. **Library inspector**
   - Show People section for selected asset
   - Show:
     - detections count
     - reviewable count
     - confirmed people
     - Review Faces link

2. **People Review page**
   - Review queue for:
     - unmatched
     - suggested
     - autoMatched
     - rejected
     - ignored
   - Actions:
     - confirm
     - reject
     - assign existing person
     - create and assign
     - ignore

3. **Library action**
   - Run People Recognition on selected assets
   - Deep-link for single asset into People Review

4. **Dev/test harness**
   - Enrollment/testing support
   - Process/reprocess assets
   - Inspect detections and derived asset people

### Must-have UX
- Clear distinction between suggested vs confirmed
- Easy asset context during face review
- Clear derived `mediaAsset.people`
- Fast reprocess loop

### Success criteria
- You can test a small corpus end to end
- You can trust what “confirmed people” means
- You can evaluate recognition quality without leaving tedography constantly

---

## Phase 2 — Search Integration
**Goal:** make People actually useful in finding photos.

### Add to Search UI
1. **Has person**
   - single person filter

2. **Has any of these people**
   - OR behavior

3. **Has all of these people**
   - AND behavior

4. **Has no people**
   - useful for cleanup and review

5. **Has reviewable faces**
   - find assets needing people review

6. Optional:
   - people count
   - confirmed-only toggle

### UI shape
- Search facet/panel section named **People**
- Typeahead person picker
- Chips/tokens for selected people
- Explicit mode selector:
  - Any
  - All

### Success criteria
- You can answer questions like:
  - show me photos with Lori
  - show me Ted and Lori together
  - show me images with unreviewed faces

This is the phase where People starts becoming broadly valuable.

---

## Phase 3 — People Browse
**Goal:** give People a proper home in the product.

### New route
- `People`

### Main page contents
1. **People grid/list**
   - person name
   - representative thumbnail
   - asset count
   - maybe review-needed badge

2. **Sort options**
   - alphabetical
   - most assets
   - most recently seen
   - needs review

3. **Search/filter**
   - search by name
   - hide archived/hidden people

### Why this phase matters
This makes People discoverable without forcing it into Library.

### Success criteria
- You can browse known people directly
- You can quickly jump into one person’s photos
- People now feels like a real tedography dimension

---

## Phase 4 — Person Detail Page
**Goal:** make each person manageable and genuinely useful.

### New surface
- Person detail page

### Contents
1. **Header**
   - name
   - representative image
   - counts

2. **Photos containing this person**
   - normal tedography asset browsing behavior

3. **Example/enrollment faces**
   - known good examples used for recognition

4. **Needs review section**
   - detections involving this person that are uncertain

5. **Management actions**
   - rename
   - archive/hide
   - possibly choose representative image

### Nice additions
- filter to solo shots vs group shots
- recent appearances
- quick jump to people review scoped to this person

### Success criteria
- A person is a manageable entity, not just a label
- You can maintain person quality over time

---

## Phase 5 — Review Productivity
**Goal:** make large-scale people review fast enough to be realistic.

### Enhancements to People Review
1. **Keyboard shortcuts**
   - confirm
   - reject
   - ignore
   - next/previous
   - assign selected person

2. **Batch actions**
   - confirm many
   - ignore many
   - reject many

3. **Scoped review modes**
   - by asset
   - by person
   - by status
   - by date range / album

4. **Better sorting**
   - highest confidence
   - lowest confidence
   - newest
   - person-specific
   - asset-specific

5. **Improved assignment flow**
   - faster picker
   - recent people
   - likely matches

### Success criteria
- Review queue becomes operationally manageable
- You can process many detections in one sitting without frustration

---

## Phase 6 — Enrollment and Recognition Quality Tools
**Goal:** improve recognition quality from within tedography.

### UI additions
1. **Enrollment status per person**
   - enrolled / not enrolled
   - number of examples

2. **Enroll from detection**
   - “Use this face as example for Ted”

3. **Example management**
   - remove poor examples
   - mark best examples
   - see diversity of examples

4. **Reprocess after enrollment**
   - one-click reprocess related assets or selected assets

### Success criteria
- Improving recognition quality becomes part of tedography workflow
- You do not have to treat the engine as a black box

---

## Phase 7 — Optional Face Overlay Tools
**Goal:** support debugging and advanced inspection without cluttering normal browsing.

### Feature
- Toggle face boxes on image

### Use cases
- debug recognition
- identify who is where in a group shot
- support review and QA

### Rules
- off by default
- probably available in:
  - inspector detail
  - Loupe
  - dedicated review mode

### Success criteria
- Helpful when needed
- Invisible when not needed

---

## Phase 8 — People as a Full Curation Dimension
**Goal:** make People participate in advanced tedography workflows.

### Integrations
1. **People + Albums**
2. **People + Search**
3. **People + Review states**
4. **People + keywords**
5. **People + date ranges**
6. Optional:
   - People + camera/lens
   - People + quality/selection state

### Example queries
- Select photos in album X with Lori
- Pending photos containing Ted
- Best selected portraits of Morgan
- Family photos with Joel and Morgan together

### Success criteria
- People becomes a major archival and curation aid

---

## Phase 9 — Advanced Maintenance Tools
**Goal:** support long-term correctness and cleanup.

### Features
1. **Merge duplicate people**
2. **Split mistaken assignments**
3. **Bulk reprocess subsets**
4. **Review by person**
5. **Cleanup ignored/rejected detections**
6. **Backfill selected album/folder/date range**

### Success criteria
- Long-term people metadata stays maintainable
- Large archive growth does not degrade quality

---

## Recommended implementation priority

### Highest priority now
1. Phase 1 completion and stabilization
2. Phase 2 Search integration
3. Phase 5 Review productivity
4. Phase 3 People browse
5. Phase 4 Person detail

### Why this order
- Search gives immediate practical value
- Review productivity reduces operational pain
- Browse/detail become more valuable once the metadata is useful and reviewable

---

## What I would implement next after current work

Given where you are now, my recommended next phases are:

### Next
**Phase 2 — Search Integration**

### After that
**Phase 5 — Review Productivity**

### Then
**Phase 3 — People Browse**

That sequence gives the best payoff soonest.

---

## Minimal milestone plan

### Milestone A — “People is testable”
- inspector status
- review page
- library action
- dev harness

### Milestone B — “People is useful”
- search by person
- search by person combinations
- find assets needing people review

### Milestone C — “People is browsable”
- People page
- Person detail page

### Milestone D — “People is scalable”
- batch review
- merge/split
- enrollment tools
- maintenance workflows

---

## Final recommendation

If I had to translate this into one practical priority list:

1. Finish making People reliable in current flows  
2. Add People to Search  
3. Speed up review work  
4. Add People browse and person detail views  
5. Add advanced maintenance and cleanup tools
