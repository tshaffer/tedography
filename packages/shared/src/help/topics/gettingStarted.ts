import type { HelpTopic } from '../types.js';

export const gettingStarted: HelpTopic = {
  slug: 'getting-started',
  title: 'Getting Started',
  category: 'Basics',
  order: 1,
  keywords: ['overview', 'workflow', 'start', 'introduction'],
  body: `Tedography is a personal photo archive and curation system. The primary workflow is:

**Import → Review (New / Pending / Keep / Discard) → Organize → Browse**

1. **Import** photos from a storage root into the archive.
2. **Review** each photo, setting its state to Keep, Pending, or Discard.
3. **Organize** kept photos into albums, tag them with keywords, and optionally identify people in them.
4. **Browse** the archive in Timeline, Albums, or Flat view, using Search or Smart Albums to find things quickly.

Every photo also has an independent **0–5 star rating**, separate from its review state, for ranking quality among photos you've already decided to keep.

See the other Help topics for details on each step, or ask a question above and Tedography will answer from these docs.`,
};
