import type { HelpTopic } from '../types.js';

export const photoAdjustments: HelpTopic = {
  slug: 'photo-adjustments',
  title: 'Photo Adjustments',
  category: 'Editing',
  order: 1,
  keywords: ['rotate', 'crop', 'capture date', 'preview', 'right-click', 'context menu'],
  body: `**Rotate** — select one or more photos, right-click one of them (Grid, Loupe, filmstrip, or full-screen Immersive; long-press in Loupe or Immersive on touch), and choose Rotate Counterclockwise, Rotate 180°, or Rotate Clockwise from the context menu. This is a non-destructive metadata operation; the original file is updated in place and derived files (display JPEG, thumbnail) are regenerated. Multiple selected photos rotate together.

**Crop** — available when exactly one photo is selected: right-click it (Grid, Loupe, or filmstrip) and choose **Crop in Preview**, which opens the source file in macOS Preview. Make your crop, save (Cmd+S), and Tedography detects the change and regenerates the display JPEG and thumbnail automatically. Close Preview when done.

**Important:** Crop modifies the original file on disk — it is destructive. Tedography keeps no pre-crop copy unless you export one first via the Edit Queue.

**Set Capture Date** — for a photo with a missing or wrong date, select it (or several) and choose **⋯ → Set Capture Date…** to enter a date/time or clear it entirely. This affects Timeline placement and album ordering; it's written to the database and does not modify the original file's EXIF data.`,
};
