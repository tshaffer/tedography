import type { HelpTopic } from '../types.js';

export const viewingAndBrowsing: HelpTopic = {
  slug: 'viewing-and-browsing',
  title: 'Viewing and Browsing',
  category: 'Basics',
  order: 4,
  keywords: ['browse', 'timeline', 'grid', 'loupe', 'filmstrip', 'survey', 'slideshow', 'presentation', 'selection', 'thumbnail size', 'badges', 'audio', 'loudphoto', 'linked audio', 'right-click', 'right click', 'context menu', 'has keywords', 'keyword status', 'keyword badge'],
  body: `**Browse modes** (⋯ → Browse Mode):

- **Timeline** (default) — photos grouped by capture month with sticky headers; best for a chronological view.
- **Albums** — shows photos from whichever albums are checked in the left sidebar.
- **Flat** — all currently visible photos in one unsectioned grid.

**Viewing modes** (toolbar): **Grid** (thumbnail grid, default), **Loupe** (single photo, full size, arrow-key navigation), **Filmstrip** (Loupe plus a thumbnail strip), **Survey** (side-by-side comparison of selected photos), **Slideshow** (full-screen auto-advance).

In Grid and Loupe, the **Inspector** panel (right side) shows metadata: filename, capture date, location, album membership, ordering mode, keywords, people, and per-asset actions. Double-click a photo, or press Enter/Space, to open the **Immersive** full-screen overlay; Escape closes it. If the photo has a linked audio recording (a LoudPhoto capture), the Inspector also shows an **Audio** section with an inline player.

**Selection:** single click selects; Cmd/Ctrl+click toggles; Shift+click range-selects; Cmd+A/Ctrl+A selects all visible; drag-select works across the grid; long-press enters touch multi-select on mobile.

**Right-click menu:** right-click (or Ctrl+click on a Mac) a Grid thumbnail, the Loupe photo, a filmstrip thumbnail, or the full-screen Immersive photo for quick actions on the selection — Keep / Discard / Pending / New, Move to Trash (only when ⋯ → Show Trash Icon is on), Move to Album…, Add to Edit Queue… (maintenance roles), Set Capture Date…, Set Location…, Rotate Counterclockwise / 180° / Clockwise, and Crop in Preview (one photo only). Rotate and crop are available only from this menu. Right-clicking a photo that isn't selected selects it alone first; right-clicking inside the selection applies to the whole selection. In Loupe and Immersive, state and Trash apply to the photo on screen (matching the toolbar), and right-clicking a filmstrip thumbnail shows that photo first. Crop in Preview is hidden in Immersive (exit fullscreen to crop). On touch devices, long-press the Loupe or Immersive photo to open the menu (in Grid, long-press still starts multi-select). Items your role can't use are grayed out. Escape (or any key), clicking elsewhere, or scrolling closes the menu.

**Timeline navigation:** the left sidebar shows a year/month navigator — click a month to scroll to that section. **Thumbnail size** is adjustable in Timeline and Albums modes (⋯ → Thumbnail Size) and persists across sessions.

**Thumbnail badges** (toggle individually under ⋯ → Badges): state color, has keywords (slate # icon, any keyword assigned), keyword status (the manually set Not started / In progress / Complete keywording marker — gray / amber / green; absent until set), Edit Queue status, edited-import / has-edited-version with a method icon (sparkle = AI, brush = manual), rating stars, and confirmed people present. A **linked audio badge** (orange speaker icon) also appears on any photo with a linked audio recording — always shown when applicable, not part of the toggle list.

**Slideshow** (⋯ → Slideshow): play/pause, next/prev, skip to first/last, adjustable speed, loop, shuffle, an info overlay (title/date/location/people/keywords), and a progress bar. Shortcuts: Space (pause/resume), ←/→ (prev/next), Home/End, F (fullscreen), S (shuffle), Escape (exit). Originals are never modified.

**Presentation Mode** (⋯ → Present) opens a second popup window at \`/present\` for showing photos on an external display (e.g. a TV). Drag it to the external screen and go fullscreen; it updates automatically as you navigate in the main window, connected via a browser BroadcastChannel (no server round-trip).`,
};
