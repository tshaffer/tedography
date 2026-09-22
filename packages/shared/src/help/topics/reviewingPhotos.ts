import type { HelpTopic } from '../types.js';

export const reviewingPhotos: HelpTopic = {
  slug: 'reviewing-photos',
  title: 'Reviewing Photos',
  category: 'Basics',
  order: 3,
  keywords: ['review', 'state', 'keep', 'pending', 'discard', 'new', 'rating', 'stars', 'keyboard shortcuts', 'trash', 'delete', 'permanently delete'],
  body: `**Photo States**

Every photo has one of four states:

| State | Meaning |
|---|---|
| New | Freshly imported; not yet reviewed |
| Pending | Deferred — decide later |
| Keep | Confirmed keeper |
| Discard | Rejected — hidden by default, but the file is never deleted |

Photos start as New. Set state with the toolbar buttons (Keep, Pending, Discard, New) or keyboard shortcuts. In Survey mode, state buttons apply to the currently focused photo, not the whole selection.

**Keyboard shortcuts** (work in Library, Survey, and Loupe when focus isn't in a text field):

| Key | Action |
|---|---|
| s | Set to Keep |
| p | Set to Pending |
| r | Set to Discard |
| Delete / Backspace | Discard (all selected photos) |
| u | Reset to New |
| ← → ↑ ↓ | Move selection (Grid) / prev-next (Loupe, Filmstrip) |
| Home / End | Jump to first / last visible photo |
| Enter / Space | Open Immersive full-screen overlay |
| Escape | Close Immersive / Survey / Slideshow, or clear selection |
| Cmd+A / Ctrl+A | Select all visible photos (Grid) |

**Trash**

Trash is different from Discard: Discard just changes a photo's state (recoverable, file untouched); Trash permanently deletes the photo's Tedography record and moves its original file into a "Trash" subfolder inside its own storage root. There's no in-app undo — recovering a trashed photo means manually moving the file back and re-importing it.

The Trash icon is hidden from the toolbar by default as a safety measure. Turn it on in ⋯ → Show Trash Icon; it appears to the right of the Keep/Discard/Pending/New buttons and applies to the current selection, same as the state buttons.

**Ratings**

Independent of state, every photo can carry a 0–5 star rating — for ranking quality among photos you've already decided to keep. Set it from the Inspector panel: click a star (1–5); click the currently-set star again to clear it. No keyboard shortcut yet. Rated photos can show an amber star-count badge (toggle in View Options → Photo Badges → Ratings), and ratings can be filtered on in Search or saved in a Smart Album.`,
};
