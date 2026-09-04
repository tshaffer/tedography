import type { HelpTopic } from '../types.js';

export const peopleReviewAndMaintenance: HelpTopic = {
  slug: 'people-review-and-maintenance',
  title: 'People Review and Maintenance',
  category: 'People',
  order: 2,
  keywords: ['people review', 'scoped people', 'recognition run summary', 'enrollment', 'merge person', 'split person', 'hide', 'archive'],
  body: `**People Review queue** (\`/people/review\`) is a workbench for reviewing many face detections at once. Each card shows the face crop, source thumbnail, detection status, suggested person and confidence, and the asset's current confirmed people. Actions: confirm, reject, ignore, assign to an existing person, create-and-assign, or add as example. Shortcuts: J/↓ next, K/↑ previous, C confirm, X reject, I ignore, A focus assign picker, N focus create-person input. Batch actions (check cards or Select All Visible, then Confirm/Reject/Ignore Selected) and queue controls (status filters, sort, person filter, auto-advance) are also available.

**Scoped People Work** — rather than processing the whole library, use **People Scope** on a subset: current Library selection, checked album(s), current Search results, or a Search date range. The dialog shows scope type/label, asset count, confirmed count, and reviewable-face count, then offers Run People Recognition, Reprocess People Recognition, or Review Faces In Scope.

**Recognition Run Summary** appears after a recognition run, bucketing results (processed, faces detected, suggested matches, confirmed, unmatched, ignored, no faces detected, failed, not processed) with jump-to-review buttons for each bucket. It persists until explicitly dismissed.

**Enrollment:** promote a confirmed face to an **example** (Add As Example, idempotent) to improve future matching; remove a bad example from Person Detail without erasing the original confirmation. Use **Reprocess Related Assets** after changing examples — it's scoped to a bounded set of recent confirmed assets, not a full reprocess.

**Merge / Split:** **Merge Person** folds a duplicate person record into a target (confirmed detections and examples move to the target; the source is hidden and archived, not deleted). **Split Selected Faces** moves a checked subset of a person's confirmed faces to a different existing or new person.

**Getting started with a large library:** work in small chunks (one album, one trip, one date range) rather than recognizing thousands of photos at once — Scope → Run Recognition → Review Faces In Scope → confirm only what you're sure of → add a few clean examples for important people. **Hidden** excludes a person from People Browse unless "Show hidden" is enabled; **Archived** treats them as inactive unless "Show archived" is enabled — neither deletes the person or their confirmed photos.`,
};
