import type { HelpTopic } from '../types.js';

export const sharingAndPrinting: HelpTopic = {
  slug: 'sharing-and-printing',
  title: 'Sharing and Printing',
  category: 'Sharing',
  order: 1,
  keywords: ['publish', 'google photos', 'print', 'order prints'],
  body: `**Publish to Google Photos** — click **Publish** (toolbar or ⋯ → Publish to Google Photos). On first use, authorize Tedography to access your Google Photos account. Configure the **album title**, **source** (current selection or the whole current view), and **upload version** (Original file — HEIC falls back to the display JPEG when the original can't be uploaded — or Display JPEG, which always converts to JPEG). Click **Publish** to upload and create the album. To share it, open the album in Google Photos and use its own Share button — Tedography doesn't manage sharing links.

**Print** — click **Print** (toolbar or ⋯ → Print) with photos selected. Choose a print provider, configure default size/finish/quantity, adjust per-photo size/finish/quantity and crop mode (fill vs. fit), then **Order** to export to the provider, or **Go to Crop** first if you want to adjust crops. Print is subject to role permissions — Limited users can print only in albums where they've been granted write access.`,
};
