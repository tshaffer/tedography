import type { HelpTopic } from '../types.js';

export const smartAlbums: HelpTopic = {
  slug: 'smart-albums',
  title: 'Smart Albums',
  category: 'Organizing',
  order: 3,
  keywords: ['smart album', 'saved search', 'filter preset'],
  body: `Smart Albums are saved searches that reopen a filtered result set with one click. They support filtering by keyword, photo state, year group, and rating (at least N stars).

**Creating one:** open Search, set the filters you want to save, then click **Save as Smart Album**.

**Managing:** open **Maintenance → Smart Albums** to rename, edit, open, or delete any Smart Album.

When a Smart Album is active in Search, the header shows **Smart Album: \\<label\\>**. If you then modify the filters, it becomes **Search (from Smart Album: \\<label\\>)** — your view has diverged from the saved version. Use **Exit Smart Album** to return to ordinary search.

Smart Albums don't store photos — they're a saved filter, not a manual album like the ones in the album tree.`,
};
