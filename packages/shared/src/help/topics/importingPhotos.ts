import type { HelpTopic } from '../types.js';

export const importingPhotos: HelpTopic = {
  slug: 'importing-photos',
  title: 'Importing Photos',
  category: 'Basics',
  order: 2,
  keywords: ['import', 'scan', 'storage root', 'heic', 'thumbnail', 'format', 'tiff', 'raw'],
  body: `Photos enter Tedography through the Import dialog. Click the **Import** button (cloud-download icon) in the toolbar to open it.

**Steps:**

1. **Choose a source folder** — the left panel shows your configured storage roots. Click one to expand it, then navigate to the folder you want to import from.
2. **Scan the folder** — click **Scan**. Tedography reads the folder and shows total files, recognized media files, and files it will skip (unsupported formats, already-imported files). See **Supported File Formats** for exactly which file types are recognized.
3. **Assign to an album** — in the right panel, choose **No album**, an **Existing album**, or **New album** (enter a name; it's created under the selected parent group).
4. **Register** — click **Import**. For each photo, Tedography:
   - Computes a SHA-256 hash and checks for duplicates
   - Extracts EXIF metadata (capture date/time, camera info, GPS with reverse-geocoding)
   - Converts HEIC to a display JPEG
   - Generates a thumbnail
   - Creates the database record
   - Schedules the People pipeline, if enabled

Imported photos appear in Library with state **New** — the start of the review workflow.

**Note:** Import only picks up new files. If already-imported photos have changed on disk (e.g. moved), use **Maintenance → Reimport** instead of Import.`,
};
