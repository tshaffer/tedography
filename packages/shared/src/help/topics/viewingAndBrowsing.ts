import type { HelpTopic } from '../types.js';

export const viewingAndBrowsing: HelpTopic = {
  slug: 'viewing-and-browsing',
  title: 'Viewing and Browsing',
  category: 'Basics',
  order: 4,
  keywords: ['browse', 'timeline', 'grid', 'loupe', 'filmstrip', 'survey', 'slideshow', 'presentation', 'selection', 'thumbnail size', 'badges'],
  body: `**Browse modes** (⋯ → Browse Mode):

- **Timeline** (default) — photos grouped by capture month with sticky headers; best for a chronological view.
- **Albums** — shows photos from whichever albums are checked in the left sidebar.
- **Flat** — all currently visible photos in one unsectioned grid.

**Viewing modes** (toolbar): **Grid** (thumbnail grid, default), **Loupe** (single photo, full size, arrow-key navigation), **Filmstrip** (Loupe plus a thumbnail strip), **Survey** (side-by-side comparison of selected photos), **Slideshow** (full-screen auto-advance).

In Grid and Loupe, the **Inspector** panel (right side) shows metadata: filename, capture date, location, album membership, ordering mode, keywords, people, and per-asset actions. Double-click a photo, or press Enter/Space, to open the **Immersive** full-screen overlay; Escape closes it.

**Selection:** single click selects; Cmd/Ctrl+click toggles; Shift+click range-selects; Cmd+A/Ctrl+A selects all visible; drag-select works across the grid; long-press enters touch multi-select on mobile.

**Timeline navigation:** the left sidebar shows a year/month navigator — click a month to scroll to that section. **Thumbnail size** is adjustable in Timeline and Albums modes (⋯ → Thumbnail Size) and persists across sessions.

**Thumbnail badges** (toggle individually under ⋯ → Badges): state color, keyword present, Edit Queue status, edited-import / has-edited-version with a method icon (sparkle = AI, brush = manual), rating stars, and confirmed people present.

**Slideshow** (⋯ → Slideshow): play/pause, next/prev, skip to first/last, adjustable speed, loop, shuffle, an info overlay (title/date/location/people/keywords), and a progress bar. Shortcuts: Space (pause/resume), ←/→ (prev/next), Home/End, F (fullscreen), S (shuffle), Escape (exit). Originals are never modified.

**Presentation Mode** (⋯ → Present) opens a second popup window at \`/present\` for showing photos on an external display (e.g. a TV). Drag it to the external screen and go fullscreen; it updates automatically as you navigate in the main window, connected via a browser BroadcastChannel (no server round-trip).`,
};
