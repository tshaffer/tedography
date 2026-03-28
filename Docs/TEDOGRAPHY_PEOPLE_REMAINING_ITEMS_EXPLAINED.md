# Tedography People Roadmap — Remaining Items Explained

This document explains the **remaining or partially complete** items from the Tedography People roadmap that were **not covered** in the earlier scoped-maintenance-v3 explanation.

For each area, it explains:
- when you would use it
- what the UI would look like
- why you would use it
- what the consequences are of not having it

---

## 1. Phase 7 — Optional Face Overlay Tools (remaining work)

Already completed:
- opt-in face boxes in the asset-scoped Library review modal
- linked selection between review items and face boxes

Still open:
- overlays in standalone People Review
- overlays in Person Detail or other photo contexts
- richer overlay behavior such as hover-only labels or zoom-aware overlays

### When you would use it
You would use these remaining overlay tools when:
- you are reviewing many faces on the standalone People Review page and want to see where each face appears on its source photo
- you are on a Person Detail page and want visual confirmation of which face/example is which in the underlying image
- you are debugging difficult group shots, partial detections, or misaligned boxes
- you want more visual confidence without opening the Library modal every time

### What the UI would look like
Likely forms:
- **Standalone People Review**: a preview area or expandable image pane with overlays for the currently selected review item
- **Person Detail**: clickable thumbnails where overlay mode can be toggled to show which detected face is the confirmed/example face
- **Richer overlay behavior**:
  - hover-only labels instead of always-on labels
  - zoomable image with overlays that stay aligned
  - subtle color coding for confirmed/suggested/ignored faces

### Why you would use it
Because overlays make face-review and maintenance much more trustworthy and much faster to reason about, especially when:
- multiple faces are present
- one face is incorrectly assigned
- you need to understand context around the face crop
- you want to verify that a chosen example face is actually a good one

### Consequences of not having it
Without broader overlay support:
- visual trust remains concentrated in the Library modal only
- review on the standalone queue page can feel more abstract than it should
- person-level maintenance may require more mental reconstruction of where a face came from
- harder cases remain slower and more error-prone to debug

This is not foundationally blocking, but it reduces visual clarity in advanced workflows.

---

## 2. Phase 8 — People as a Full Curation Dimension (remaining work)

Already completed in meaningful part:
- Search by People
- people-aware filtering exists as a real workflow

Still open / less developed:
- deeper integration of People with broader curation flows
- more polished combinations such as:
  - People + Albums
  - People + Review states
  - People + Keywords
  - People + camera/lens metadata
- richer people-aware curation UX beyond filtering

### When you would use it
You would use this when People stops being “something I can search for” and becomes “something I actively use to curate photos.”

Examples:
- “show me the best selected photos of Lori from Portugal 2025”
- “show me pending family photos with Morgan and Joel”
- “show me photos of Ted shot with the 85mm lens”
- “show me reviewable faces only in the Family album”

### What the UI would look like
This likely would not be one single page. It would show up as:
- deeper combinations inside Search
- more explicit cross-filter summaries
- quicker multi-dimensional browse flows
- possibly saved combinations or presets later

Examples:
- Search chips that show a richer combined filter summary
- album page with additional People-focused refinement
- person-aware curation shortcuts like “show best of this person in current album”

### Why you would use it
Because this is where People becomes not just metadata, but part of how you organize, select, and explore your archive.

It lets tedography answer richer real-world questions:
- “Which shots of Lori from this trip are my keepers?”
- “Which family photos still need work?”
- “What portraits of Morgan did I shoot on the Fuji lens?”

### Consequences of not having it
Without this deeper curation integration:
- People remains useful, but a little siloed
- Search works, but combinations feel more mechanical than elegant
- tedography gets less leverage from all the work put into People metadata
- people-aware discovery remains less fluid than it could be

So this is about **depth of usefulness**, not core capability.

---

## 3. Phase 9 — broader maintenance / operational tooling (remaining work)

Already completed:
- merge
- split
- example maintenance
- scoped maintenance/backfill

Still open:
- broader maintenance dashboard
- reusable named scopes
- resumable scope workflows
- run history / auditability
- richer cleanup tooling for ignored/rejected populations
- larger-scale orchestration ergonomics

### When you would use it
You would use these features when people maintenance becomes:
- repetitive
- multi-session
- operationally large
- something you want to manage over time instead of one ad hoc fix at a time

Examples:
- working through all travel albums over months
- revisiting recent imports every week
- checking what subsets have been processed or reprocessed recently
- cleaning up long tails of ignored/rejected/unmatched faces

### What the UI would look like
A practical version might look like:
- a **maintenance panel** or **People Scope+** area
- recent runs
- saved scopes
- scope status summaries
- maybe a list of “still needs people work” buckets

Not necessarily a giant dashboard, but more operational memory and continuity.

### Why you would use it
Because once the archive gets large, the problem becomes:
- not “can tedography do this?”
- but “can I keep doing this systematically over time?”

These tools help you:
- resume work
- avoid duplicated effort
- understand what remains
- make people maintenance more structured and sustainable

### Consequences of not having it
Without these operational tools:
- maintenance remains more ad hoc
- repeated work is easier to lose track of
- larger archive cleanup is harder to manage over days/weeks/months
- tedography feels less scalable operationally

This matters more as your archive and cadence of people maintenance grow.

---

## 4. Stronger example/enrollment quality management

Still open:
- pinned/best example management
- example ranking
- diversity heuristics
- richer quality guidance
- more advanced example curation workflows

### When you would use it
You would use these when:
- a person has many examples and not all are equally good
- recognition quality is inconsistent and you want to improve it deliberately
- you need better control over which examples represent a person
- you want tedography to help you choose better examples, not just store them

Examples:
- choosing the best 5 examples of Lori instead of carrying 20 mediocre ones
- avoiding too many nearly identical examples
- keeping a mix of glasses/no-glasses, indoor/outdoor, younger/older shots

### What the UI would look like
Likely additions on Person Detail:
- pin/star best examples
- sort or rank examples
- badges like:
  - “strong example”
  - “duplicate-ish”
  - “thin set”
- lightweight quality hints such as:
  - “all examples are from the same shoot”
  - “needs more varied angles”

### Why you would use it
Because once you have a real example set, the next challenge is **quality**, not just quantity.

These tools help:
- improve recognition quality
- avoid polluting the model with weak examples
- make example sets more intentional
- reduce bad downstream matches

### Consequences of not having it
Without stronger example-quality tools:
- example sets can become noisy or redundant
- recognition quality may plateau or degrade
- users have to guess what makes a good example set
- tedography helps with enrollment, but not as much with **quality control**

This is a refinement layer, but a very useful one once you have real usage.

---

## 5. Person management beyond current basics

Currently supported:
- rename
- hide/unhide
- archive/unarchive
- merge
- split-related maintenance

Still open:
- aliases
- notes
- explicit representative-image selection
- richer per-person management controls

### When you would use it
You would use these when:
- one person is known by multiple names
- you want to record disambiguating context
- the automatically chosen representative image is not the one you want
- you want a more curated person identity inside tedography

Examples:
- “Grandma” vs “Ruth”
- “Troy” vs “Troy + beard era” notes
- selecting a flattering/recognizable representative image instead of a random confirmed asset thumbnail

### What the UI would look like
On Person Detail, likely additions would be:
- aliases field
- notes field
- “Choose representative image” action
- maybe additional metadata like hidden reason or status

### Why you would use it
Because once a person becomes a first-class entity in the app, users often want just a little more control over how that person is represented and understood.

### Consequences of not having it
Without these:
- person records remain functional but less expressive
- disambiguation relies more on memory
- auto-selected representative imagery may be mediocre
- person management feels slightly unfinished for long-term use

Not blocking, but noticeable as the system matures.

---

## 6. Person Detail deepening

Current page is solid, but further enhancements remain possible:
- fuller per-person review workspace embedded in the page
- stronger recent-appearances features
- solo/group distinctions
- richer person-centric photo exploration

### When you would use it
You would use this when Person Detail becomes a place you return to often for:
- reviewing a person’s recent photos
- checking their unresolved review items
- exploring how they appear across time
- focusing on solo portraits vs group appearances

### What the UI would look like
Possible enrichments:
- embedded person-scoped review queue
- recent appearances section
- solo vs group filter
- more capable photo grid/exploration controls
- timeline-like or date-based grouping for this person

### Why you would use it
Because Person Detail can become more than a summary page — it can become the main operational workspace for understanding one person’s presence in the archive.

### Consequences of not having it
Without these:
- Person Detail remains useful but lighter than it could be
- users still need to bounce to Search or People Review for richer person-specific work
- the person page feels more like a summary hub than a full working surface

Again, this is about **depth**, not basic usability.

---

## 7. Review page refinements beyond current productivity pass

Already improved:
- shortcuts
- batch actions
- recent-people assignment helpers
- queue-local person filter
- auto-advance

Still open:
- broader batch flows
- more advanced scoped review modes
- additional keyboard workflow polish
- stronger reuse/shared UI between modal and standalone review
- richer queue summaries/progress indicators

### When you would use it
You would use these when:
- doing high-volume queue review repeatedly
- wanting faster repetitive operations
- wanting clearer progress through a scope or queue
- wanting the modal and standalone review page to feel more unified

### What the UI would look like
Likely refinements:
- more batch actions than confirm/reject/ignore
- better progress summaries at top of queue
- richer filter and scope combinations
- stronger shortcut hints or mode indicators
- more consistent action layout between modal and standalone review

### Why you would use it
Because once a review queue gets larger, small ergonomic improvements add up quickly.

### Consequences of not having it
Without these:
- review is still quite usable, but not yet maximally efficient
- queue work can feel a little more manual than it needs to
- modal and standalone review may still feel like cousins rather than siblings
- progress through review scopes is less visible than ideal

This is mostly a productivity/polish area now.

---

## 8. Broader operational/scaled maintenance workflows

Still open:
- reusable named scopes
- lightweight run history
- background-style progress for larger scoped jobs
- resume-later workflows for scope-based maintenance
- broader archive-wide operational tooling

### When you would use it
You would use these when:
- people maintenance becomes a repeated long-term activity
- scopes become large enough to work over several sessions
- you want to know what has already been processed
- you want to manage archive cleanup in a more systematic way

Examples:
- working through a year of imports in chunks
- keeping recurring scopes like “recent imports needing people review”
- resuming an unfinished maintenance effort later

### What the UI would look like
Likely additions:
- saved scope list
- run history
- scope progress/status
- resumable scoped review entries
- maybe a light operations panel

### Why you would use it
Because it turns people maintenance from a set of one-off actions into something sustainable at archive scale.

### Consequences of not having it
Without these:
- scope-based maintenance remains more ad hoc
- resumability is weaker
- larger ongoing maintenance efforts require more memory and manual reconstruction
- tedography remains very capable, but less operationally mature

This matters more over time than immediately.

---

## Practical summary

## Which remaining items are mostly “polish / scale” vs “new value”?

### Mostly polish / scale
- broader overlay support
- review page refinements
- broader operational/scaled maintenance workflows
- person management beyond basics

### More meaningful new value
- deeper People-as-curation integration
- stronger example/enrollment quality management
- deeper Person Detail capabilities

---

## If you wanted to defer some things
A very reasonable deferral order would be:

### Easier to defer for now
- broader operational/scaled maintenance workflows
- richer overlay variants beyond the modal
- person notes/aliases/representative-image control

### Harder to defer forever if People becomes central
- stronger example/enrollment quality management
- deeper people-aware curation integration
- deeper Person Detail capabilities

---

## Bottom line

The People system already covers the highest-value foundation. The remaining roadmap items are mostly about:
- making the system more polished
- making it scale better operationally
- making People a richer curation dimension
- improving the quality and intentionality of enrollment/example management

If you stop now, the feature set is already strong.
If you continue, these are the main unfinished areas that would deepen the value of the system rather than simply duplicating what already exists.
