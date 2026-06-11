# Tedography User Manual

Tedography is a personal photo archive and curation system. The primary workflow is:

**Import → Review (New / Pending / Keep / Discard) → Organize → Browse**

---

## Table of Contents

1. [Viewing and Browsing](#1-viewing-and-browsing)
   - 1.1 [Library and Viewing Modes](#11-library-and-viewing-modes)
   - 1.2 [Selection Behavior](#12-selection-behavior)
   - 1.3 [Album Ordering](#13-album-ordering)
   - 1.4 [Slideshow](#14-slideshow)
2. [Organizing Your Library](#2-organizing-your-library)
   - 2.1 [Keywords](#21-keywords)
   - 2.2 [Smart Albums](#22-smart-albums)
3. [Searching](#3-searching)
   - 3.1 [Search Filters](#31-search-filters)
   - 3.2 [People Search](#32-people-search)
   - 3.3 [Natural Language Search](#33-natural-language-search)
4. [People](#4-people)
   - 4.1 [Core Concepts](#41-core-concepts)
   - 4.2 [People in Library](#42-people-in-library)
   - 4.3 [Asset Review Dialog](#43-asset-review-dialog)
   - 4.4 [People Browse](#44-people-browse)
   - 4.5 [Person Detail](#45-person-detail)
   - 4.6 [People Review Queue](#46-people-review-queue)
   - 4.7 [Scoped People Work](#47-scoped-people-work)
   - 4.8 [Recognition Run Summary](#48-recognition-run-summary)
   - 4.9 [Enrollment and Recognition Quality](#49-enrollment-and-recognition-quality)
   - 4.10 [People Maintenance](#410-people-maintenance)
   - 4.11 [Getting Started with a Large Library](#411-getting-started-with-a-large-library)
5. [Editing Photos](#5-editing-photos)
   - 5.1 [Edit Queue](#51-edit-queue)
   - 5.2 [AI Edit Queue](#52-ai-edit-queue)
6. [Duplicate Management](#6-duplicate-management)
   - 6.1 [Duplicate Group Review](#61-duplicate-group-review)
   - 6.2 [Duplicate Pair Review](#62-duplicate-pair-review)
   - 6.3 [Needs Re-review](#63-needs-re-review)
   - 6.4 [Effect on Library](#64-effect-on-library)
   - 6.5 [Recommended Workflow](#65-recommended-workflow)
7. [Users and Permissions](#7-users-and-permissions)
   - 7.1 [Roles](#71-roles)
   - 7.2 [Logging In and Managing Your Account](#72-logging-in-and-managing-your-account)
   - 7.3 [What Each Role Can Do](#73-what-each-role-can-do)
   - 7.4 [Admin Tools](#74-admin-tools)

---

## 1. Viewing and Browsing

### 1.1 Library and Viewing Modes

The **Library** is the main browsing area. It supports several viewing modes accessible from the toolbar:

- **Grid** — thumbnail grid of all visible photos
- **Loupe** — single-photo full-size view with arrow-key navigation
- **Survey** — multi-photo comparison view
- **Slideshow** — full-screen playback (see [Section 1.4](#14-slideshow))
- **Filmstrip** — loupe view with a horizontal strip of thumbnails below

In Grid and Loupe modes the **Inspector** panel on the right shows metadata for the currently selected photo: filename, capture date, location, keywords, people, album membership, and order information.

### 1.2 Selection Behavior

Tedography maintains an ordered list of selected photos.

| Action | Result |
|---|---|
| Single click | Selects that photo only |
| Cmd/Ctrl + click | Adds or removes that photo from the selection |
| Shift + click | Range-selects from the last selected photo to the clicked photo |
| Cmd+A / Ctrl+A | Selects all currently visible photos |

**Important:** When you use Cmd/Ctrl to build a selection incrementally, photos are added in click order. When you use Shift or Cmd+A, the selection is built in the current visible display order. Features that consume the selection (such as the first photo in Loupe mode) use display order, not click order.

### 1.3 Album Ordering

Albums use a hybrid ordering model:

- Photos with a usable capture date sort **chronologically** first.
- Photos without a capture date, or photos you have manually moved, appear in the **manual** section after the chronological section.

When you have exactly one album checked and one photo selected, the Inspector shows the current ordering mode for that photo in that album: `Capture Time`, `Manual`, or `Manual (No Capture Time)`.

**Changing ordering for a photo:**

- **Use Manual Order** — moves the selected photo from the chronological section into the manual section for this album.
- **Use Capture Time** — moves the selected photo back to chronological ordering.

Once a photo is in the manual section, the toolbar shows move controls: **Move to Top**, **Move Up**, **Move Down**, **Move to Bottom**. These affect only the manual section of the current album and only when one album and one photo are selected.

Ordering choices are album-specific. The same photo can use capture-time ordering in one album and manual ordering in another.

### 1.4 Slideshow

Slideshow mode plays photos full-screen.

**First release controls:**

| Control | Description |
|---|---|
| Play / Pause | Start or pause playback |
| Next / Previous | Move one photo forward or back |
| Skip to first / last | Jump to the beginning or end |
| Adjustable speed | Choose time per slide (e.g. 2s, 5s, 10s) |
| Loop toggle | Loop continuously or stop at the end |
| Shuffle | Play in random order |
| Info overlay | Show title, date, location, people, and keywords; fades in on hover |
| Progress bar | Shows current position in the slideshow |
| Fullscreen | Maintains aspect ratio of each photo |

**Keyboard shortcuts during playback:**

| Key | Action |
|---|---|
| Space | Pause / resume |
| Arrow keys | Next / previous |
| F | Toggle fullscreen |
| S | Toggle shuffle |

Click a photo to pause and see details. Originals are never modified during slideshow playback.

**Planned for future releases:** transitions (fade, crossfade, Ken Burns effect), background music, export to video, and a screensaver mode.

---

## 2. Organizing Your Library

### 2.1 Keywords

Keywords are descriptive metadata attached to photos, separate from albums. A photo can belong to any album and simultaneously have any number of keywords.

Keywords are hierarchical. Examples:
- `People / Lori`
- `Nature / Flowers`
- `Places / Hawaii`
- `Activities / Hiking`

Searching for a parent keyword (e.g. `Nature`) returns all photos tagged with that keyword or any of its children (`Nature / Flowers`, `Nature / Gardens`, etc.).

**Managing the keyword hierarchy:**

Open **Maintenance → Keyword Hierarchy** to:

- Create a root keyword (top-level category)
- Create a child keyword under a selected keyword
- Rename a keyword — the same ID is preserved and all existing assignments update automatically
- Reparent a keyword — move it under a different parent, or clear its parent to make it a root keyword

Keyword names are globally unique (case-insensitive, whitespace-normalized). You cannot have two different keywords with the same label in different branches.

**Assigning keywords to photos:**

Select one or more photos, then use the **Keywords** section in the Inspector.

- Existing keywords on the selected photo are shown as chips. Click **×** on a chip to remove it.
- Use the **Add Keywords** field to search for and add existing keywords, or type a new keyword name to create one inline.
- Inline-created keywords are created as root keywords. Use Maintenance to reparent them afterward if needed.

When **multiple photos** are selected:
- Only keywords common to all selected photos are shown.
- Adding a keyword applies it to all selected photos.
- Removing a shown keyword removes it from all selected photos.

The Inspector also shows a **Recent Keywords** section — up to 8 keywords you have most recently assigned, shown as clickable chips for fast re-use.

### 2.2 Smart Albums

Smart Albums are saved searches. They let you reopen a filtered result set with one click.

**Supported filters in Smart Albums:**
- Keyword
- Photo state
- Year group

**Creating a Smart Album:**
1. Open **Search** and set the filters you want to save.
2. Click **Save as Smart Album**.

**Managing Smart Albums:**
Open **Maintenance → Smart Albums** to rename, edit filters for, open, or delete any Smart Album.

When a Smart Album is active in Search, the header shows **Smart Album: \<label\>**. If you modify the filters after opening a Smart Album, the header changes to **Search (from Smart Album: \<label\>)** to indicate your view has diverged from the saved version. Use **Exit Smart Album** to return to ordinary search.

Photos are not stored in a Smart Album — it is a saved filter, not a manual album. Album membership actions still target manual albums.

---

## 3. Searching

### 3.1 Search Filters

Open **Search** from the top navigation. Filters available include:

- **Photo state** — New, Pending, Keep, Discard
- **Album** — one or more albums from the album tree
- **Keyword** — one keyword (hierarchy-aware; selecting a parent matches all descendants)
- **People** — one or more confirmed people, with Any or All matching
- **Date range** — From and/or To
- **Filename pattern**
- **Publication status**

When a keyword filter is active, a **Keyword: …** chip appears above the results. Clear it with the chip's remove control or the **Clear Keyword** button.

The results header shows context:
- **Search** — ordinary ad hoc search
- **Smart Album: \<label\>** — an exact saved Smart Album
- **Search (from Smart Album: \<label\>)** — a search that started from a Smart Album but no longer exactly matches it

### 3.2 People Search

The **People** section in Search lets you find photos by confirmed person data and face-review state.

| Filter | What it finds |
|---|---|
| Has person | Photos where one selected person is confirmed |
| Has any of these people | Photos where at least one of the selected people is confirmed (Match: Any) |
| Has all of these people | Photos where every selected person is confirmed (Match: All) |
| Has no confirmed people | Photos with no confirmed people data yet |
| Has reviewable faces | Photos that still have unresolved face detections needing review |

**Examples:**
- *Show me photos with Lori* — select Lori
- *Show me Ted and Lori together* — select Ted and Lori, set Match: All
- *Show me photos that still need people review* — enable Has reviewable faces

People filters operate on confirmed derived people only. "Has reviewable faces" is a separate flag for unresolved work.

### 3.3 Natural Language Search

The Search panel includes a natural language input at the top. Type a plain-English description of what you want to find and press Enter (or click the search button). Tedography translates your query into search filters using the Claude AI and overlays the result onto your current filters.

Only fields that Claude could identify in your query are changed — filters you have set manually and that are not mentioned in the query are preserved.

Examples:
- *Show me kept photos of Lori from Hawaii*
- *Find photos from 2019 with the keyword Nature*
- *Photos that are still pending review*

---

## 4. People

### 4.1 Core Concepts

Tedography uses three related but distinct concepts for People:

**Confirmed face detection** — a specific detected face in a specific photo has been reviewed and confirmed as belonging to a person. This is the atomic unit of people data.

**Example face** — a confirmed face that is also being used as a reference to improve future recognition. Not every confirmed face needs to become an example.

**Asset people** (`mediaAsset.people`) — the confirmed people list for a whole photo, derived from confirmed detections. This is the trusted result used by Search and the Inspector.

The key rule: **confirmed = trusted; reviewable = still needs work.** Only confirmed data flows into search results and the Inspector's people list.

### 4.2 People in Library

When one photo is selected in **Library**, the Inspector shows a **People** section with:
- Number of face detections
- Number of reviewable (unresolved) faces
- Confirmed people names

From the Inspector you can:
- Click **Review Faces** to open the asset review dialog without leaving Library
- Click **Open Full People Review** to go to the standalone review queue filtered to that asset

The top toolbar in Library also supports:
- **Run People Recognition** — run face detection and matching on the current selection
- **People Scope** — open scoped people tools for the current selection or checked album

### 4.3 Asset Review Dialog

From Library, clicking **Review Faces** opens an in-context review dialog for the selected photo. Use this when you want to review faces without leaving your current Library view.

**Actions available per face:**
- Confirm suggested/current person
- Reject a wrong suggestion
- Assign to an existing person
- Create a new person and assign
- Ignore a face
- Add a confirmed face as an example

**Optional face boxes:** Enable **Show Face Boxes** to overlay colored bounding boxes on the source image. The box for the currently selected review card is highlighted. Clicking a box selects its review card. Colors indicate status: Confirmed, Suggested, Auto Matched, Unmatched, Rejected, Ignored.

Use the in-context dialog for one-photo review while staying in Library. Use the **standalone People Review page** when you want to work through many photos at once.

### 4.4 People Browse

The People browse page at `/people` shows a card for every known person with:
- Display name
- Confirmed photo count
- Representative thumbnail (or a placeholder initial)
- Last-seen date
- "Needs review" badge when related faces still need work
- Hidden / archived badges when applicable

**Sort and filter options:**
- Search by name
- Sort: alphabetical, most photos, most recently seen, needs review
- Show or hide archived people
- Show or hide hidden people

Clicking **View Photos** on a person card opens the main app in Search with that person applied as a People filter, showing all photos confirmed to contain them.

### 4.5 Person Detail

Each person has a detail page at `/people/:personId`. Reach it by clicking any person card in People Browse.

**The page shows:**
- Display name, representative image, confirmed photo count, last-seen date
- Review-needed count (unresolved faces still associated with this person)
- A grid of confirmed photos (based on derived `mediaAsset.people`, not unresolved suggestions)
- An example-face strip
- Enrollment status: `Not enrolled`, `Enrolled: N examples`, or `Enrolled: N examples (thin set)`

**Actions available:**
- **View In Search** — opens Search filtered to this person
- **Review Related Faces** — opens People Review filtered to this person
- Rename display name
- Hide / unhide
- Archive / unarchive
- Remove an example face
- Add a confirmed face as an example
- Remove a confirmed face from this person
- Reassign a confirmed face to another person
- **Split Selected Faces** — move a subset of confirmed faces to a different person (see [Section 4.10](#410-people-maintenance))
- **Merge Person** — merge this person record into another (see [Section 4.10](#410-people-maintenance))
- **Reprocess Related Assets** — re-run recognition on a bounded set of recent confirmed assets for this person

### 4.6 People Review Queue

The standalone People Review page at `/people/review` is a queue-based workbench for reviewing many face detections at once.

**Each review card shows:**
- Face crop preview and source asset thumbnail
- Detection status (suggested, auto-matched, unmatched, confirmed, rejected, ignored)
- Suggested person and confidence
- Assigned person if already confirmed
- Current derived `mediaAsset.people` for that asset

**Actions per card:**
- Confirm, reject, ignore
- Assign to an existing person
- Create a new person and assign
- Add confirmed face as an example (enroll)

**Keyboard shortcuts** (when focus is not in a text field):

| Key | Action |
|---|---|
| J or ↓ | Next face |
| K or ↑ | Previous face |
| C | Confirm current face |
| X | Reject current face |
| I | Ignore current face |
| A | Focus the assign-existing picker |
| N | Focus the create-new-person input |

**Batch actions:**
- Check one or more cards (or use **Select All Visible**)
- Use the batch bar to **Confirm Selected**, **Reject Selected**, or **Ignore Selected**

**Queue controls:**
- Status filters: suggested, auto-matched, unmatched, confirmed, rejected, ignored
- Sort: newest first, highest confidence, lowest confidence, filename, asset ID
- Person filter within the current queue
- Auto-advance after action (optional)

The queue defaults to showing suggested, auto-matched, and unmatched faces. When opened for a single asset, confirmed detections are included so you can see the whole state.

### 4.7 Scoped People Work

Rather than processing your entire library at once, use **People Scope** to work on a manageable subset.

**Available scopes:**
- Current Library selection
- Checked album(s) in Library Albums mode
- Current Search results
- Search date-range scope (when From and/or To are set)

**To start scoped work:**
1. In Library, select assets — or switch to Albums mode and check albums — or go to Search and set filters.
2. Click **People Scope** in the toolbar.
3. The dialog shows a summary: scope type, scope label, asset count, confirmed people count, reviewable faces count.
4. Choose an action:
   - **Run People Recognition** — detect and match faces for the scope
   - **Reprocess People Recognition** — re-run recognition on already-processed assets
   - **Review Faces In Scope** — open People Review filtered to this scope

For large scopes, the dialog asks for confirmation before processing.

### 4.8 Recognition Run Summary

After **Run People Recognition** or **Reprocess People Recognition** completes, Tedography shows a **People Recognition Run Summary** dialog.

**The dialog shows counts for:**

| Bucket | Meaning |
|---|---|
| Assets processed | Recognition ran and completed |
| Faces detected | At least one face found |
| Suggested matches | At least one face needing human review |
| Confirmed people | At least one already-confirmed face |
| Unmatched faces | At least one face detected but not matched to anyone |
| Ignored faces | At least one face filtered out (too small, low quality, etc.) |
| No faces detected | Engine ran and found zero faces |
| Failed | Recognition threw an error (shown in red) |
| Not processed | Engine skipped (already processed, force not set) |

**Note:** "No faces detected" is different from "Not processed" — the former means the engine ran and found nothing; the latter means it did not run at all.

**Action buttons:**
- **Review Suggested Matches (n)** — go to People Review for suggested-match assets
- **Review Unmatched Faces (n)** — go to People Review for unmatched-face assets
- **Review Ignored Faces (n)** — go to People Review for ignored-face assets
- **Show No-Face Assets (n)** — select no-face assets in the current grid
- **Show Failed Assets (n)** — select failed assets in the current grid
- **Return to Album** — dismiss

The summary persists across navigation. If you click **Review Suggested Matches** and then return to Library, the summary reappears so you can access the remaining bucket actions. It is cleared only when explicitly dismissed.

### 4.9 Enrollment and Recognition Quality

Every confirmed face *can* also be promoted to an **example face** that the recognition engine uses to match future photos. Better examples lead to better suggestions.

**Enrollment status shown on Person Detail:**
- `Not enrolled` — confirmed photos exist but no example faces yet
- `Enrolled: N examples` — actively used examples
- `Enrolled: N examples (thin set)` — only a small number of active examples

**Adding an example:**
1. Confirm a face as belonging to a person.
2. Click **Add As Example** (available in People Review, the asset review dialog, and Person Detail).
3. Tedography stores the example and updates the recognition engine. The action is idempotent — clicking the same confirmed face multiple times does not create duplicates.

**Removing a bad example:**
From Person Detail, click the remove control on an example face. This removes it from the active example set and updates recognition enrollment, but does not erase the original confirmed detection.

**Reprocessing after example changes:**
Use **Reprocess Related Assets** on Person Detail to re-run recognition on a bounded set of recent confirmed assets for that person. This is intentionally scoped — it is not a full-library reprocess.

### 4.10 People Maintenance

As your archive grows, mistakes happen. Tedography provides maintenance tools to keep people data correct.

#### Merge Duplicate People

Use **Merge Person** on Person Detail when two person records represent the same real person.

What merge does:
- The target person survives.
- Confirmed detections from the source person are reassigned to the target.
- Example faces from the source are moved to the target when possible.
- Affected `mediaAsset.people` values are recomputed.
- The source person is hidden and archived (not deleted).

#### Split Person

Use **Split Selected Faces** on Person Detail when a person record is mostly correct but some confirmed faces belong to a different person.

1. Open a person detail page.
2. In **Confirmed Faces**, check the faces you want to move.
3. Click **Split Selected Faces**.
4. Choose an existing destination person or enter a new person name.
5. Confirm.

Split is the right tool when the current person is mostly correct and you only need to move a subset of faces.

#### Reassign or Remove a Confirmed Face

On Person Detail, individual confirmed faces support:
- **Reassign** — move this face assignment to another person
- **Remove from Person** — remove the confirmation (updates derived asset people)
- **Add as Example** — promote to an example face

#### Correct Mistaken Confirmed Assignments

If a face was confirmed to the wrong person:
1. Open that person's detail page.
2. Find the face in **Confirmed Faces**.
3. Use **Reassign** to move it to the correct person, or **Remove from Person** if it should not be assigned to anyone yet.

These actions keep example management and confirmed-detection history separate. Removing a confirmed detection updates the asset's derived people list.

### 4.11 Getting Started with a Large Library

If you have thousands of existing photos, do not try to run People recognition across the whole archive in one pass. Work in small, inspectable chunks.

**Good starting scopes:** one small album, one trip, one year/month date range, or a small Library selection.

**Recommended first pass:**
1. Pick a small, familiar scope.
2. Use **People Scope**.
3. Run **Run People Recognition** for that scope.
4. Open **Review Faces In Scope**.
5. Confirm only people you are confident about.
6. For important people, add a few clean confirmed faces as examples — prefer sharp, front-facing, well-lit images.
7. Reject wrong suggestions. Ignore non-useful faces.
8. Check how many assets still have reviewable faces.

**Building good example sets:**
- Aim for several clear, varied examples per important person.
- Include some variation over time (same person across different years/events).
- Remove weak examples if they are blurry, tiny, occluded, or belong to someone else.

**Reprocess after improving examples:**
Once you have better examples, use **Reprocess Related Assets** on Person Detail, or run scoped reprocessing on a related album or date range. Then review the new suggestions.

**Progress checks:**
- In People Review, confirm the unresolved queue is shrinking for the current scope.
- In Search, filter by a person and spot-check that returned photos really contain them.
- Use **Has no confirmed people** to find photos that may still need processing.
- Use **Has reviewable faces** to find photos with unresolved detections.
- Sort People Browse by **Needs Review** to find people with remaining work.

**Suggested chunk size:** start with 25–100 photos when building initial examples. Expand to a full album or date slice only after Search spot-checks look consistently clean.

**Hide vs. Archive:**
- **Hidden** — excluded from normal People Browse results unless "Show hidden people" is enabled. Useful for minor or transient people.
- **Archived** — treated as inactive in People Browse unless "Show archived people" is enabled. Useful for merged source records and historical records.

Neither action deletes the person or removes them from confirmed photos.

---

## 5. Editing Photos

### 5.1 Edit Queue

The Edit Queue lets you export original photos to an external folder, edit them with any tool, and import the edited results back into Tedography. Imported files inherit key metadata from their source.

**Setup:** add to `apps/api/.env`:
```
TEDOGRAPHY_EDIT_PATH=/absolute/path/to/your/edit/folder
```
The folder is created automatically. The path must be within (or the same as) one of your registered storage roots.

**Step-by-step workflow:**

**1. Add photos to the queue**

With a photo selected, click the **Edit Queue** toolbar button (brain icon):
- **Add to Edit Queue** — adds the selected photo, optionally with an editing note/prompt
- **Edit Prompt** — update the note for a photo already in the queue

You can also open the **Edit Queue** dialog (View Queue) to see all queued photos, edit notes inline, and remove entries.

**2. Export**

In the Edit Queue dialog, check the photos you want to export (or click **Select all**), then click **Export (N)**. This copies the original files to your edit folder and writes:
- `prompts.txt` — one line per file: `filename: prompt`
- `manifest.json` — used during import; **do not delete or rename this file**

**3. Edit externally**

Open the exported files in any editing tool. Save your results using this naming convention:

| Original | Edited file name |
|---|---|
| `IMG_1234.HEIC` | `IMG_1234_edited.jpg` |
| `IMG_1234.HEIC` | `IMG_1234_edited.png` |

Rules:
- The base name before `_edited` must match the original filename's base (case-insensitive)
- `_edited` must appear immediately before the file extension
- Any supported format is accepted as output (JPEG, PNG, HEIC, etc.)
- Save the edited file to the same edit folder — do not move it elsewhere

**4. Import**

In the Edit Queue dialog, click **Import Edited Files**. Tedography scans the edit folder for `*_edited.*` files, matches each to its source, and imports it as a new asset inheriting:

| Property | Source |
|---|---|
| Album memberships | Copied from original |
| Keywords | Copied from original |
| Location | From edited file EXIF if present; otherwise from original |
| Capture date/time | From edited file EXIF if present; otherwise from original |
| People tags | Copied from original |
| Photo state | Always starts as **New** |

The original file is never modified.

**5. After import**

- **Clear Queue** — removes all entries from the edit queue (does not affect files or assets)
- **Clear Edit Folder** — deletes all files from the edit folder (two-step confirmation required); safe to use after a successful import since edited files are moved to their destination folder during import

**Import result statuses:**

| Status | Meaning |
|---|---|
| `imported` | Successfully created a new asset |
| `skipped` | No matching manifest entry, or unsupported format |
| `error` | Import failed (duplicate, missing storage root, etc.) |

Edit history is recorded for every file processed, including failures. View it via **Edit Queue → View Edit History**.

**Multiple edits of the same photo:** only one `_edited` file per source photo per import pass is supported. To import two different edited versions, do two separate export → edit → import cycles.

**Manifest file:** `manifest.json` links edited filenames to their source assets. Do not delete or rename it until after import is complete.

### 5.2 AI Edit Queue

The AI Edit Queue lets you mark photos for AI-assisted editing using a natural-language prompt, then send them to the Gemini API. Tedography handles the upload and saves edited results automatically.

**Setup:** add to `apps/api/.env`:
```
GOOGLE_API_KEY=your-google-api-key-here
TEDOGRAPHY_AI_QUEUE_EXPORT_PATH=/absolute/path/to/ai-queue-output-folder
```

**Step-by-step workflow:**

**1. Queue a photo**

While browsing, select a photo. Open the **More** menu (overflow button in the toolbar) and choose **Add to AI Queue…**. A dialog shows the filename and a text field for your prompt. Type what you want done and click **Add to Queue**.

Prompt examples: `make the sky more dramatic`, `convert to black and white, high contrast`, `remove the background clutter`

To change a queued photo's prompt, select it again and choose **Edit AI Queue Prompt…**.

**2. Review the queue**

The **AI Edit Queue** panel appears in the sidebar whenever items are queued. Each entry shows the filename, prompt (or *no prompt*), and a **×** remove button.

**3. Process with Gemini**

Click **Process with Gemini** in the queue panel. Tedography processes the **first entry** in the queue:
1. Reads the photo from disk
2. Sends the image and prompt to the Gemini API
3. Saves the result as `<original-filename>_gemini.jpg` in the configured output folder

When processing completes, the panel reports success or failure. Click **Process with Gemini** again to process the next entry. HEIC/HEIF originals are sent directly — no conversion needed.

**4. Review the results**

Open the configured output folder in Finder to review Gemini-edited versions alongside the originals. **Originals are never modified.**

**5. Export Queue (manual alternative)**

Click **Export Queue** to copy the original files and a `prompts.txt` file to the output folder without calling the API. Use this if you want to upload to an external AI service manually.

**6. Clear the queue**

Click **Clear** to empty the queue. This does not delete any output files.

**Notes:**
- Output filenames: `photo.jpg` → `photo_gemini.jpg`. If two queued photos from different folders share the same filename, the second will overwrite the first in the output folder.
- Each click of **Process with Gemini** sends only the first queued entry — one at a time.
- Queue entries are stored in MongoDB and survive app restarts.

---

## 6. Duplicate Management

Tedography has two duplicate review surfaces. The **Duplicate Group Review** is the primary workflow; **Duplicate Pair Review** is for lower-level cleanup.

### 6.1 Duplicate Group Review

Route: `/duplicates/groups`

The left sidebar lists provisional duplicate groups ordered by priority:
1. **Needs Re-review** — a previously resolved group now needs revisiting
2. **Unresolved** — not yet reviewed
3. **Resolved** — a confirmed resolution exists

Within each bucket, larger groups appear first. Page-level counts show totals for each bucket across the whole queue.

**Group detail:**
When a group is selected, the detail pane shows review status, asset count, current canonical asset (if resolved), and a Resolution Rules summary (keeper, duplicates, not in group, unclassified).

**Classifying assets in a group:**

Each asset can be marked:
- **Keeper** — exactly one asset must be the keeper
- **Duplicate** — this asset is a non-canonical copy
- **Not In Group** — this asset is excluded from this particular duplicate set (it may still appear in other groups)

All assets must be classified before the group can be saved.

**Grid Mode vs. Focus Mode:**

- **Grid Mode** — shows the whole group at once; best for quick classification and choosing a keeper while seeing all members
- **Focus Mode** — shows one asset large with a candidate list on the right; supports Up/Down navigation, wraparound, and a compare subset

**Compare subset in Focus Mode:**
Add specific assets to a **Compare** set and switch to **Compare Set** view to narrow the candidate list and navigation to just those assets. This is a temporary session state and does not affect the duplicate resolution itself.

**Historical hints:**
Click **Load Historical Hints** to see best-effort counts of how often each asset has historically appeared as keeper, duplicate, or not-duplicate. These are informational only.

**Saving and reopening:**
- **Save Group Resolution** — confirms the keeper and duplicates, marks excluded assets as Not In Group, and updates Library duplicate visibility
- **Reopen Group** — clears the current confirmed resolution and returns the group to active review
- **Refresh Groups** — reloads the provisional group queue from current duplicate-candidate connectivity; useful after a series of saves to catch regrouping of excluded assets

### 6.2 Duplicate Pair Review

Route: `/duplicates/review`

The pair-review page shows one candidate pair at a time. Actions:
- Keep left / keep right / keep both
- Not duplicate
- Uncertain / Ignore

If a pair-review action touches an asset that belongs to an already-confirmed duplicate group, Tedography saves the pair review but marks the affected group for **Needs Re-review** rather than silently overriding the group resolution. A notice on the pair-review page directs you to Duplicate Group Review to resolve the conflict.

### 6.3 Needs Re-review

A group is marked **Needs Re-review** when:
- New candidate connectivity appears that changes the group composition
- A pair-review action conflicts with an already-confirmed group resolution

The current confirmed resolution still exists — Tedography is telling you to revisit it in `/duplicates/groups`. It does not silently merge the new candidate into the old result.

### 6.4 Effect on Library

Confirmed duplicate resolutions affect the main Library:
- The **canonical (keeper)** asset is shown normally
- Confirmed **non-canonical (duplicate)** members are hidden or marked as duplicates

Library duplicate visibility is refreshed after saving or reopening a group resolution. The UI uses optimistic updates so the change is reflected promptly.

`Keeper` and `Duplicate` badges in Library are driven by confirmed group resolutions, not by unresolved candidate relationships.

### 6.5 Recommended Workflow

1. Open `/duplicates/groups`
2. Work through **Needs Re-review** groups first
3. Then work through **Unresolved** groups
4. Use **Grid Mode** for broad classification across the whole set
5. Use **Focus Mode** and the Compare subset for careful visual comparison of specific candidates
6. Save the authoritative group resolution
7. Use `/duplicates/review` only for lower-level pair cleanup or edge cases

---

## 7. Users and Permissions

### 7.1 Roles

Tedography supports multiple users with role-based access control. Every action is tied to a **feature**, and each role has one of three permission values for each feature:

| Permission | Meaning |
|---|---|
| **allow** | Role can always use this feature |
| **deny** | Role can never use this feature |
| **per-album** | Role can use this feature only in albums where they have been explicitly granted write access |

**Built-in role permission table:**

| Feature | Admin | Full | Limited |
|---|---|---|---|
| Import | allow | allow | deny |
| Rotate and crop | allow | allow | per-album |
| Set photo state | allow | allow | per-album |
| Create albums | allow | allow | allow |
| Move photos to album | allow | allow | per-album |
| Remove from album | allow | allow | per-album |
| Keyword management | allow | allow | deny |
| People face review | allow | allow | per-album |
| Print | allow | allow | per-album |
| Maintenance | allow | deny | deny |

Custom roles can also be created with any combination of permissions.

### 7.2 Logging In and Managing Your Account

A login screen appears before the application loads. Select your name from the list and enter your PIN.

Once logged in:
- Your **name** appears in the top-right corner of the toolbar.
- **Log out** ends your session and returns to the login screen.
- **Change PIN** opens a dialog to update your PIN. You must supply your current PIN; the new PIN must be at least 4 characters.

### 7.3 What Each Role Can Do

**All users** (regardless of role):
- See the login screen and log in
- Change their own PIN

**Limited users** see locked albums where they have no write access (🔒 icon). Controls for state changes, moving/removing photos, rotating, printing, and people review are enabled only in albums they have been explicitly granted write access to. Import, keyword management, and maintenance tools are hidden entirely.

**Full users** have access to all features except Maintenance. The Maintenance menu item and the Reimport/Rebuild Derived Files buttons in the Inspector are hidden.

**Admin users** have access to all features, including Maintenance, all import operations, AI queue processing, and user/role management.

### 7.4 Admin Tools

**Managing album writers:**
Right-click any album in the album tree and choose **Manage Writers…**. This dialog shows Admin and Full users (always have access) and lets you grant or revoke write access for Limited users on that album.

**Users page (`/admin/users`):**
Accessible from the overflow (⋯) menu for Admin users only. Capabilities:
- View all users (name, role, ID)
- Change a user's role — select a new role in the inline dropdown and click Save; an admin cannot change their own role
- Create a user — enter display name, role, and initial PIN (minimum 4 characters)
- Delete a user — click × and confirm; an admin cannot delete their own account

**Roles page (`/admin/roles`):**
Accessible via **Manage Roles →** in the Users page header. Shows every role as a card with a full permission grid. Click **Edit** to modify a role's name and permissions inline. The three built-in roles (admin, full, limited) can be edited but not deleted. Custom roles can be deleted when no users are assigned to them. Create new roles with a custom ID, display name, and permission grid.
