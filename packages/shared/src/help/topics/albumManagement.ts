import type { HelpTopic } from '../types.js';

export const albumManagement: HelpTopic = {
  slug: 'album-management',
  title: 'Album Management',
  category: 'Organizing',
  order: 1,
  keywords: ['album', 'group', 'tree', 'move', 'reorder', 'ordering', 'drag and drop', 'manual order', 'capture time', 'chronological', 'date range', 'capture date order', 'count badge', 'photo count'],
  body: `The album tree is hierarchical: **Groups** are folders that hold albums or other groups; **Albums** are leaf nodes that hold photos. Photos belong to albums, never directly to groups.

**Creating:** from the toolbar in Library → Albums mode, use **New Group** or **New Album**; from the tree's right-click context menu, use **Create Child Album** or **Create Top-Level Group**. You can also create a new album inline from the Import dialog.

**Context menu** (right-click a node): Rename, Delete (album must be empty), Move…, Reorder Up/Down, an **Album Order** submenu setting a group's child order mode (**Custom**, **Name**, **Numeric Then Name**, or **Capture Date**), Import Photos Here, and (Admin only) Manage Writers….

**Capture Date order** sorts a group's leaf albums by the earliest photo in each — automatic, no manual maintenance as you add albums. Albums spanning a wide date range (a "misc" or "Q1"-style catch-all covering several months) will still only get one position in the list, since a range that overlaps several single-event albums can't have one "correct" spot — a **date-range caption** under each album name (Display Options ⋯ → Date range, on by default) shows exactly what span each album covers, so those overlaps are visible instead of just looking out of order. Reclassifying photos out of wide-range catch-alls into proper event albums is the real fix for the overlap itself, not just its display.

**Tree sort mode** (⋯ → Album Sort) controls the sidebar's own display order for **Groups** (Custom / Name / Month-Name) — separate from a group's own child order mode (which governs its leaf albums, above), and doesn't change where photos appear in the grid.

**Count badge:** the number on each leaf album's row is always its real photo count (never a placeholder), but its color carries a second signal — **amber** means the count is accurate but that album's photos haven't been loaded into the browser yet (checking it, or switching to a view that includes it, triggers that load); **green** means its photos are loaded and ready to browse, not just counted. Colors update live as you check/uncheck albums — no refresh needed to see one flip from amber to green.

**Album photo ordering:** albums use a single interleaved timeline. Photos with a capture date sort chronologically by default; any photo can be manually placed anywhere (including between two dated photos) and holds that position.

- **Drag and drop** is the primary way to reorder (needs exactly one checked album). Drop a thumbnail onto another — a blue bar shows before/after. Dropping converts that photo to manual placement automatically. Drag a multi-selection to move the whole block together.
- **⋯ → Order in Album:** Use Manual Order, Use Capture Time, Arrange by Filename (numeric-aware; useful for a roll of photos before positioning them as a block), and Move to Top/Up/Down/Bottom.
- **Capture-date trust:** Mark Capture Date Wrong/Correct flags a photo's date as inaccurate without changing it; flagged photos show as "suspect" in the ordering badge (⋯ → View badges → Ordering — amber ! for suspect dates, blue pin for manual placement).

Ordering is per-album — the same photo can be chronological in one album and manually placed in another.

**Show in Album:** with one photo selected, the Inspector's **Show in Album** link jumps to Albums mode with that album checked, scrolled to the photo — handy after finding it via Search.`,
};
