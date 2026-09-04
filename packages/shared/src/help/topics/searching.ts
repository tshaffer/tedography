import type { HelpTopic } from '../types.js';

export const searching: HelpTopic = {
  slug: 'searching',
  title: 'Searching',
  category: 'Search',
  order: 1,
  keywords: ['search', 'filter', 'natural language search', 'people search', 'date range', 'filename pattern'],
  body: `Open **Search** from the top navigation.

**Filters:** photo state, album, keyword (hierarchy-aware), people (Any/All match), date range, capture date availability (**Dated only** / **Undated only** / **Dated or undated** — useful for finding photos that need a manual date), five Edit Queue filters (is manually/AI edited import, has manually/AI edited version, in edit queue — each Any/Yes/No, combined with a Match AND/OR toggle), rating (at least N stars), filename pattern, and publication status.

**People search:** Has person, Has any of these people (Match: Any), Has all of these people (Match: All), Has no confirmed people, Has reviewable faces (unresolved face detections still needing review).

**Natural language search:** the Search panel has a plain-English input at the top. Type a description and press Enter — Tedography translates it into search filters using Claude AI and overlays the result onto your current filters, changing only the fields it could identify. Examples: "Show me kept photos of Lori from Hawaii", "Find photos from 2019 with the keyword Nature", "Photos that are still pending review".

The results header shows context: **Search** (ad hoc), **Smart Album: \\<label\\>** (an exact saved Smart Album), or **Search (from Smart Album: \\<label\\>)** (a Smart Album with modified filters).

**Show in Library:** with one or more photos selected in Search results, click **Show in Library** to switch to Albums mode, check the album(s) containing them, and scroll to the first selected photo.`,
};
