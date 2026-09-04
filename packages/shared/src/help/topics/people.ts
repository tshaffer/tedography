import type { HelpTopic } from '../types.js';

export const people: HelpTopic = {
  slug: 'people',
  title: 'People',
  category: 'People',
  order: 1,
  keywords: ['people', 'face', 'recognition', 'person detail', 'people browse', 'confirmed'],
  body: `Tedography uses three related concepts: a **confirmed face detection** (a specific face in a specific photo, reviewed and confirmed as a person — the atomic unit), an **example face** (a confirmed face also used as a reference to improve future matching), and **asset people** (\`mediaAsset.people\` — the trusted, confirmed people list for a whole photo, used by Search and the Inspector). Rule of thumb: **confirmed = trusted; reviewable = still needs work.**

**In Library:** with one photo selected, the Inspector's People section shows detection count, reviewable-face count, and confirmed names, with **Review Faces** (in-context dialog) and **Open Full People Review** links. The toolbar also has **Run People Recognition** (on the current selection) and **People Scope** (broader scoped tools).

**Asset review dialog:** per face you can Confirm, Reject, Assign to an existing person, Create a new person and assign, Ignore, or Add as example. Optional **Show Face Boxes** overlays colored bounding boxes on the photo (color = status); clicking a box selects its review card.

**People Browse** (\`/people\`) shows a card per known person: name, confirmed photo count, thumbnail, last-seen date, and a "needs review" badge. Search by name; sort by alphabetical, most photos, most recently seen, or needs review; toggle showing archived/hidden people. **View Photos** opens Search filtered to that person.

**Person Detail** (\`/people/:personId\`) shows confirmed photos, an example-face strip, and enrollment status (\`Not enrolled\`, \`Enrolled: N examples\`, or \`Enrolled: N examples (thin set)\`). Actions: View In Search, Review Related Faces, rename, hide/unhide, archive/unarchive, add/remove example faces, remove or reassign a confirmed face, Split Selected Faces, Merge Person, and Reprocess Related Assets. See the People Review and Maintenance topic for merge/split details.`,
};
