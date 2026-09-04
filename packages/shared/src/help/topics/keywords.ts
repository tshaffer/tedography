import type { HelpTopic } from '../types.js';

export const keywords: HelpTopic = {
  slug: 'keywords',
  title: 'Keywords',
  category: 'Organizing',
  order: 2,
  keywords: ['keyword', 'tag', 'hierarchy', 'inspector'],
  body: `Keywords are descriptive metadata attached to photos, separate from albums — a photo can belong to any album and have any number of keywords. Keywords are hierarchical (e.g. \`People / Lori\`, \`Nature / Flowers\`). Searching a parent keyword returns photos tagged with it or any descendant.

**Managing the hierarchy** — open **Maintenance → Keyword Hierarchy** to create a root keyword, create a child under a selected keyword, rename (assignments update automatically), or reparent (including clearing a parent to make it root). Keyword labels are globally unique, case-insensitive, and whitespace-normalized.

**Assigning to photos** — select one or more photos and use the **Keywords** section of the Inspector. Existing keywords show as chips (click × to remove). Use **Add Keywords** to search-and-add an existing keyword or type a new name to create one inline (inline-created keywords are root keywords; reparent later in Maintenance if needed).

With multiple photos selected: only keywords common to all are shown; adding applies to all selected; removing a shown keyword removes it from all selected.

The Inspector also shows **Recent Keywords** — up to 8 most-recently-assigned keywords as quick-add chips, stored locally in your browser.`,
};
