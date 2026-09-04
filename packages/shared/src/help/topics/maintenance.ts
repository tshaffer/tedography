import type { HelpTopic } from '../types.js';

export const maintenance: HelpTopic = {
  slug: 'maintenance',
  title: 'Maintenance',
  category: 'Admin',
  order: 1,
  keywords: ['maintenance', 'verify', 'reimport', 'rebuild derived files', 'thumbnails', 'admin'],
  body: `Open **Maintenance** from **⋯ → Maintenance** (Admin only) for folder-level operations on already-imported assets — for new files, use Import instead.

- **Verify Known Assets in Folder** — checks that each known asset's source file and derived files (display JPEG, thumbnail) are present and intact. Non-mutating.
- **Reimport Known Assets in Folder** — re-reads source files and updates metadata (EXIF, dimensions, location, etc.) from the current file state. Use after moving files on disk or external metadata changes. Mutates asset records.
- **Rebuild Derived Files in Folder** — regenerates display JPEG and thumbnail for known assets in the folder. Use after derived files are corrupted, or after rotations that need refreshed thumbnails.

The Maintenance dialog also holds **Smart Albums** management and the **Keyword Hierarchy** editor.

**Per-asset Inspector actions** (Admin only, with one photo selected): **Reimport** and **Rebuild Derived Files**, scoped to just that asset — convenient for fixing something you notice while browsing without opening the full dialog.`,
};
