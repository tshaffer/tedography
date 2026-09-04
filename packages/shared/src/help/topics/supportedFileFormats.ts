import type { HelpTopic } from '../types.js';

export const supportedFileFormats: HelpTopic = {
  slug: 'supported-file-formats',
  title: 'Supported File Formats',
  category: 'Basics',
  order: 5,
  keywords: ['format', 'file type', 'extension', 'tiff', 'tif', 'raw', 'nef', 'dng', 'heic', 'jpg', 'jpeg', 'png', 'video', 'unsupported'],
  body: `Tedography recognizes these photo file types on import: **JPG/JPEG**, **PNG**, **HEIC**, **TIFF** (\`.tif\` / \`.tiff\`), and two RAW formats — **Nikon NEF** and **Adobe DNG**. A file with any other extension is skipped during Scan and Import and reported as unsupported.

**Video is not supported yet.** No video file type (e.g. \`.mp4\`, \`.mov\`) is currently recognized during import.

**How each format displays once imported:**

- **JPG/JPEG and PNG** — served as-is for both the thumbnail and the full-size view.
- **HEIC, TIFF, NEF, and DNG** — automatically converted to a JPEG for the full-size display view (and thumbnail), so they display normally in any browser, the same as a JPG or PNG. Downloading the **original** file (as opposed to the display view) always gives you back the true, untouched source file — HEIC, TIFF, NEF, or DNG, whichever it started as.

Photos imported before this conversion was added for TIFF/NEF/DNG won't have a display JPEG yet — use **Maintenance → Reimport** (or **Rebuild Derived Files**) on their folder to generate one.`,
};
