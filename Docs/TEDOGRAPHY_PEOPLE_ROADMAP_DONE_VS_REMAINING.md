# Tedography People Roadmap — Done vs Remaining

## Overview

This document summarizes which major parts of the Tedography People roadmap are substantially complete, which are partially complete, and which remain open.

## Mostly complete

### Phase 1 — Practical Validation UI
Substantially complete:
- Library inspector People section
- Library action to run people recognition
- asset-scoped face review modal/dialog from Library
- standalone People Review page
- dev/test harness
- clarified Phase 1 workflow and coherence across surfaces

### Phase 2 — Search Integration
Substantially complete:
- Search People section
- search by one person
- search by multiple people with Any / All semantics
- search for assets with no confirmed people
- search for assets with reviewable faces
- confirmed vs reviewable semantics kept distinct

### Phase 3 — People Browse
Substantially complete:
- `/people` browse page
- people cards with counts
- sorting
- filtering
- click-through into person-centric workflows

### Phase 4 — Person Detail
Substantially complete:
- `/people/:personId`
- person header
- confirmed photo grid
- review-related handoff
- basic person management
- integration from People Browse into Person Detail

### Phase 6 — Enrollment and Recognition Quality Tools
Substantially complete:
- explicit example/enrollment face concept
- enrollment/example status on person page
- Add as Example flow
- Remove Example flow
- Reprocess Related Assets
- example management centered on Person Detail

## Substantial Phase 9 progress already completed

### Phase 9 — Advanced Maintenance Tools (large first slice complete)
Completed or substantially completed:
- Merge Person
- mistaken confirmed-assignment correction
- example cleanup
- Split Person v1
- scoped people maintenance/backfill tools v1
- expanded scoped maintenance/backfill tools beyond the initial slice

## Partially complete

### Phase 7 — Optional Face Overlay Tools
Completed:
- opt-in face boxes in the asset-scoped Library review modal
- linked selection between review items and face boxes

Still open:
- overlays in standalone People Review
- overlays in Person Detail or other photo contexts
- richer overlay behavior such as hover-only labels or zoom-aware overlays

### Phase 8 — People as a Full Curation Dimension
Completed in meaningful part:
- Search by People
- people-aware filtering now exists as a real workflow

Still open / less developed:
- deeper integration of People with broader curation flows
- more polished combinations such as:
  - People + Albums
  - People + Review states
  - People + Keywords
  - People + camera/lens metadata
- richer people-aware curation UX beyond filtering

### Phase 9 — broader maintenance / operational tooling
Completed:
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

## Still largely open

### Stronger example/enrollment quality management
Still open:
- pinned/best example management
- example ranking
- diversity heuristics
- richer quality guidance
- more advanced example curation workflows

### Person management beyond current basics
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

### Person Detail deepening
Current page is solid, but further enhancements remain possible:
- fuller per-person review workspace embedded in the page
- stronger recent-appearances features
- solo/group distinctions
- richer person-centric photo exploration

### Review page refinements beyond current productivity pass
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

### Broader operational/scaled maintenance workflows
Still open:
- reusable named scopes
- lightweight run history
- background-style progress for larger scoped jobs
- resume-later workflows for scope-based maintenance
- broader archive-wide operational tooling

## Practical summary

## Highest-value core is already in place
The Tedography People feature set is already strong and usable:
- recognition and review workflows exist
- Search integration exists
- People Browse exists
- Person Detail exists
- example/enrollment management exists
- merge/split maintenance exists
- scoped maintenance exists

## What remains is mostly about:
- polish
- scale
- deeper integration
- richer maintenance ergonomics
- more advanced example-quality guidance

## Suggested mental model

### Mostly complete
- Phase 1
- Phase 2
- Phase 3
- Phase 4
- Phase 6
- a substantial part of Phase 9

### Partially complete
- Phase 7
- Phase 8
- Phase 9

### Still largely open
- broader operational/scaled maintenance workflows
- deeper curation integration
- more advanced example-quality tooling

## Bottom line

Tedography’s People roadmap has already covered the highest-value core product work. The remaining items are important, but they are primarily about refinement, scalability, and deeper integration rather than foundational capability.
