# Broader Maintenance / Backfill Tools v3 — Explanation

This document explains the proposed **Broader Maintenance / Backfill Tools v3** items in practical terms:

1. **Reusable named scopes**
2. **Background-style scoped jobs / progress**
3. **Scope history / recent runs**
4. **Better scoped review continuity**

For each one, it covers:
- when you would use it
- what the UI would look like
- why you would use it
- what the consequences are of not having it

---

## 1. Reusable named scopes

### What it is
A **named scope** is a saved subset of the archive that you expect to return to repeatedly for people work.

Examples:
- `Italy 2024`
- `Family 2023 Q4`
- `Recent imports`
- `Cozumel trip`
- `Unreviewed portraits`
- `Lori + reviewable faces`

A named scope is not just a one-time selection. It is a reusable definition of a chunk of the library that matters to you.

### When you would use it
You would use named scopes when:
- you know you will work on the same subset over multiple sessions
- the subset has a meaningful identity, such as a trip, month, album, or import batch
- you want to stop and resume work later without rebuilding the same selection/filter
- you want to separate people cleanup into manageable chunks

Typical real-world examples:
- “I want to work through all people cleanup for our Portugal trip over the next week.”
- “I want a recurring bucket for recent imports that still need people review.”
- “I want to revisit all assets in a 3-month family period after I improve Lori’s example faces.”

### What the UI would look like
A reasonable first version would likely look like this:

#### In the People Scope dialog
After choosing a scope, there could be:
- **Save Scope**
- a name field
- maybe a short description or label preview

Example:

```text
Scope: Album — Italy 2024
Assets: 842

[Run People Recognition] [Review Faces In Scope]
[Save Scope...]
```

Then a small dialog:

```text
Save Scope
Name: [Italy 2024                       ]
Description: [optional]
[Cancel] [Save]
```

#### Somewhere reusable later
You might then see:
- a **Saved Scopes** list
- maybe under Maintenance or People Scope
- maybe a dropdown inside the People Scope dialog

Example:

```text
Saved Scopes
- Italy 2024
- Family Q4 2023
- Recent imports
- Unreviewed Maui photos
```

Clicking one would restore that scope.

### Why you would use it
Because many people workflows are not one-and-done.

You would use named scopes to:
- avoid rebuilding the same search/filter repeatedly
- work in chunks that match how you think about your archive
- pause and resume maintenance work
- build a personal operating rhythm like:
  - finish one trip
  - finish one family period
  - finish one import batch

This is especially useful when the archive is too large to think about globally.

### Consequences of not having it
Without named scopes:
- you must recreate scopes manually each time
- you are more likely to forget what subset you intended to work on
- your workflow becomes more ad hoc and less repeatable
- larger maintenance efforts become harder to resume over days/weeks

In practice, that means:
- more friction
- more duplicated setup work
- a greater chance of drifting away from structured archive maintenance

That said, if you mainly do people work in small ad hoc chunks, this may not hurt much right now.

---

## 2. Background-style scoped jobs / progress

### What it is
This means that when you run people recognition or reprocessing on a larger scope, tedography would treat it more like a tracked job instead of a synchronous UI action that just waits and hopes for completion.

It does **not** have to mean a giant workflow engine.
A lightweight version would just mean:
- create a scoped job
- show progress
- show completed/failed counts
- let the user continue working while it runs

### When you would use it
You would use background-style progress when:
- the scope is large enough that it takes noticeable time
- you do not want to stare at one dialog waiting
- you want to launch processing and then keep browsing/reviewing
- you want clearer reporting of what finished and what failed

Typical examples:
- reprocessing 400 assets after improving example faces
- running people recognition on a whole trip album
- running a scoped cleanup pass on recent imports

### What the UI would look like
A lightweight version might look like this:

#### In the People Scope dialog
Instead of only saying “processed 34 / failed 2” at the end, it might say:

```text
People Scope: Album — Italy 2024
Assets: 842

[Run People Recognition]

Status:
Running…
Processed: 184 / 842
Failed: 3
Skipped: 12
```

#### Optional global indicator
Maybe a small status chip somewhere in the app:

```text
People Jobs: 1 running
```

Clicking it could open a small panel:

```text
Scoped People Jobs
- Italy 2024 — Running — 184 / 842
- Recent imports — Completed — 57 / 57
```

The UI does not need to be fancy. The key idea is that larger runs become trackable instead of “fire and wait.”

### Why you would use it
Because longer-scoped people operations become much more comfortable when they are:
- trackable
- interrupt-tolerant
- less blocking
- more transparent

You would use it to:
- launch a larger scope confidently
- keep working while it runs
- understand progress and failures
- avoid uncertainty about whether something is stuck or still active

### Consequences of not having it
Without background-style progress:
- larger scoped runs feel more fragile
- the UI may feel blocked or ambiguous during longer operations
- users may avoid medium-to-large scopes because they feel risky
- it becomes harder to tell whether a run partially finished, fully failed, or is just slow

In practice, this is mostly a **comfort and scale** issue.
For small scopes, you may not miss it much.
For larger scopes, it becomes more important.

---

## 3. Scope history / recent runs

### What it is
This means tedography would remember recent scoped maintenance actions and show useful information about them.

Examples:
- which scope you ran
- when you ran it
- what action you took
- how many assets were processed
- whether it finished cleanly
- whether reviewable work still remains in that scope

This is not a full audit subsystem. It is lightweight operational memory.

### When you would use it
You would use scope history when:
- you cannot remember whether you already processed a scope
- you want to know when you last ran recognition on a subset
- you want to see whether a previous run likely improved things
- you want to continue methodically through multiple scopes over time

Typical examples:
- “Did I already reprocess Italy 2024 after fixing Lori’s examples?”
- “When was the last time I ran people recognition on Recent Imports?”
- “Which scopes still have lots of reviewable faces?”

### What the UI would look like
A small recent-runs section could appear in a few places.

#### In the People Scope dialog
Maybe a section like:

```text
Recent Scope Runs
- Italy 2024 — Reprocess — yesterday — 842 assets
- Recent imports — Run recognition — 2 days ago — 57 assets
- Family Q4 2023 — Review handoff — 5 days ago
```

#### In a small maintenance panel
Could also be a simple list:

```text
Recent People Scope Activity
- Reprocessed Italy 2024
- Reviewed Recent imports
- Ran recognition on Family Q4 2023
```

This does not need to become a dashboard. Even a compact list would help.

### Why you would use it
Because maintenance work is often spread out over time.

You would use scope history to:
- avoid repeating work unnecessarily
- remember where you left off
- see whether a scope has already been processed/reprocessed
- keep archive maintenance more systematic

### Consequences of not having it
Without scope history:
- you rely on memory
- it is easier to duplicate effort
- it is harder to maintain a steady cadence of people cleanup
- you lose continuity across multiple sessions

For small ad hoc workflows, this may not matter much.
For longer-running archive cleanup, it becomes increasingly useful.

---

## 4. Better scoped review continuity

### What it is
This means that when you jump into People Review from a scope, the review experience should feel like a continuation of that scope, not just a temporary filtered queue.

Examples:
- clear scope label in the review banner
- counts of how much remains in that scope
- ability to return to or resume that scope later
- better awareness that you are reviewing “Italy 2024” rather than an anonymous saved asset set

This is more about **continuity of thought** than raw functionality.

### When you would use it
You would use this when:
- you are reviewing people work within a meaningful subset
- you care about finishing that subset
- you may leave and come back later
- you want review to feel tied to the scope, not disconnected from it

Typical examples:
- “I’m reviewing all unresolved faces in Italy 2024.”
- “I want to work through recent imports until the queue is clean.”
- “I want to review just the current date-filtered family photos.”

### What the UI would look like
A stronger scoped review banner might look like:

```text
Reviewing Faces In Scope
Album: Italy 2024
Assets in scope: 842
Assets with reviewable faces: 61
Reviewable detections remaining: 148
```

Maybe with actions like:
- **Back to Scope**
- **Resume Saved Scope**
- **Refresh Scope Summary**

Even without extra buttons, the important upgrade is that the review page clearly reminds you what you are working on.

### Why you would use it
Because it helps the review flow feel intentional and bounded.

You would use it to:
- stay mentally oriented
- know what subset you are clearing
- know whether you are making progress
- avoid the feeling that the review queue is just an endless blob

This is especially helpful once people cleanup becomes a real recurring part of tedography use.

### Consequences of not having it
Without better scoped review continuity:
- scoped review can feel temporary and anonymous
- it is harder to know what subset you are actually working through
- the experience is less resumable and less satisfying
- users may lose confidence that they are making structured progress

This does not block people review, but it makes it feel less cohesive over time.

---

## Practical summary

## Which of these matter most if you are not feeling urgency?
If you are not feeling much need for v3 right now, my practical ranking would be:

### Most valuable first
1. **Better scoped review continuity**
2. **Reusable named scopes**

These improve understanding and repeatability without requiring heavier infrastructure.

### More valuable once scopes get bigger
3. **Background-style scoped jobs / progress**
4. **Scope history / recent runs**

These become more important once you start doing medium-to-large scope operations regularly.

---

## Why your reluctance makes sense
Your reluctance makes sense because these are **workflow scale and continuity features**, not core capability features.

You already have:
- good review
- good search
- good browse
- good person maintenance
- scoped maintenance in useful first forms

So v3 is not about unlocking something impossible.
It is about making larger, repeatable archive maintenance **more comfortable, more structured, and more resumable**.

If that is not a pain point for you right now, it is completely reasonable to defer it.

---

## Bottom line

### Reusable named scopes
Good for repeatable multi-session work on meaningful archive chunks.

### Background-style scoped jobs / progress
Good when scoped runs are large enough that waiting synchronously becomes annoying or ambiguous.

### Scope history / recent runs
Good for remembering what you already worked on and avoiding repeated effort.

### Better scoped review continuity
Good for making scoped review feel like a coherent, resumable task instead of a temporary filtered queue.

None of these are required to make the People system useful today.
They mainly become valuable when your people-maintenance workflow becomes more structured, repeated, and archive-scale.
