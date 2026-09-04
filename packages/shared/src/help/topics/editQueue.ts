import type { HelpTopic } from '../types.js';

export const editQueue: HelpTopic = {
  slug: 'edit-queue',
  title: 'Edit Queue',
  category: 'Editing',
  order: 2,
  keywords: ['edit queue', 'export', 'manifest', 'edited', 'lightroom', 'photoshop', 'ai edit', 'edit history', 'archive'],
  body: `The Edit Queue exports original photos to an external folder so you can edit them in any tool (Lightroom, Photoshop, an AI tool, etc.) and imports the results back into Tedography. An original can have any number of edited versions — several manual and several AI edits can coexist (the thumbnail badge only shows one indicator per method; use Search to see the actual count).

**Setup:** add \`TEDOGRAPHY_EDIT_PATH=/absolute/path/to/edit/folder\` to \`apps/api/.env\` (must be within a registered storage root; the folder is created automatically).

**Workflow:**

1. **Add to queue** — select a photo, click **Add to Edit Queue** (optionally add a note). Grayed out if it's already queued — use **Open Queue** or **Edit Note** from the Edit Queue toolbar menu (brain icon) to update or re-export/re-import an already-queued photo.
2. **Export** — open **Edit Queue**, check photos, click **Export (N)**. Originals are copied to the edit folder; \`manifest.json\` is merged (never delete or rename it) and \`notes.txt\` is written. In the list, a green ✓ means exported and linked; amber means an \`_edited\` file exists but its manifest link is missing — re-checking and exporting again fixes it.
3. **Edit externally** — save results as \`<originalBasename>_edited.<ext>\` (e.g. \`IMG_1234_edited.jpg\`) into the same edit folder. For multiple versions of one original, keep each filename starting with \`<originalBasename>_edited\`, e.g. \`IMG_1234_edited_ai.png\` and \`IMG_1234_edited_manual.jpg\`.
4. **Import** — click **Import Edited Files** (scans the whole folder, independent of which queue rows are checked). A **Classify Edited Files** dialog opens listing every matched file (checked by default) with a Manual/AI toggle per file — uncheck any you're not ready to import. Click **Confirm Import (N)**. Each imported file becomes a new asset that inherits album memberships, keywords, people tags, and photo state **New**; location and capture date come from the edited file's EXIF if present, otherwise from the original. The edited file is moved (not copied) out of the edit folder to sit next to its source; the exported copy of the original is left behind in the edit folder. Misclassified? Change **Edit Method** in the Inspector afterward — no re-import needed.
5. **Clean up** — remove a single queue entry with the **×** next to it (doesn't touch files); **Clear Queue** removes all entries. The dialog's **Edit Folder Files** list shows everything currently in the folder; delete individual files there, or use **Clear Edit Folder** to wipe the whole folder (exported originals, manifest, notes, and any not-yet-imported edits) — a two-step confirmation.

**Edit History** (Edit Queue → View Edit History) records every processed file with source/edited filenames, import status, and an editable Note. **Archives** let you move completed entries out of the active list into named, read-only groups (Archive Selected / View Archives) to keep the active list focused.`,
};
