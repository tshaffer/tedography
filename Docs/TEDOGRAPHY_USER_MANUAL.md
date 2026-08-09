# Tedography User Manual

Tedography is a personal photo archive and curation system. The primary workflow is:

**Import → Review (New / Pending / Keep / Discard) → Organize → Browse**

---

## Table of Contents

1. [Importing Photos](#1-importing-photos)
2. [Reviewing Photos](#2-reviewing-photos)
   - 2.1 [Photo States](#21-photo-states)
   - 2.2 [Setting Photo State](#22-setting-photo-state)
   - 2.3 [Keyboard Shortcuts](#23-keyboard-shortcuts)
3. [Viewing and Browsing](#3-viewing-and-browsing)
   - 3.1 [Library Browse Modes](#31-library-browse-modes)
   - 3.2 [Viewing Modes](#32-viewing-modes)
   - 3.3 [Selection Behavior](#33-selection-behavior)
   - 3.4 [Timeline Navigation and Thumbnail Size](#34-timeline-navigation-and-thumbnail-size)
   - 3.5 [Albums Mode Options](#35-albums-mode-options)
   - 3.6 [Thumbnail Badges](#36-thumbnail-badges)
   - 3.7 [Slideshow](#37-slideshow)
   - 3.8 [Presentation Mode](#38-presentation-mode)
4. [Album Management](#4-album-management)
   - 4.1 [Album Tree Structure](#41-album-tree-structure)
   - 4.2 [Creating Groups and Albums](#42-creating-groups-and-albums)
   - 4.3 [Album Tree Context Menu](#43-album-tree-context-menu)
   - 4.4 [Moving Albums in the Tree](#44-moving-albums-in-the-tree)
   - 4.5 [Album Tree Sort Mode](#45-album-tree-sort-mode)
   - 4.6 [Album Photo Ordering](#46-album-photo-ordering)
   - 4.7 [Show in Album](#47-show-in-album)
5. [Organizing Your Library](#5-organizing-your-library)
   - 5.1 [Keywords](#51-keywords)
   - 5.2 [Smart Albums](#52-smart-albums)
6. [Searching](#6-searching)
   - 6.1 [Search Filters](#61-search-filters)
   - 6.2 [People Search](#62-people-search)
   - 6.3 [Natural Language Search](#63-natural-language-search)
   - 6.4 [Show in Library from Search](#64-show-in-library-from-search)
7. [Photo Adjustments](#7-photo-adjustments)
   - 7.1 [Rotate](#71-rotate)
   - 7.2 [Crop](#72-crop)
   - 7.3 [Set Capture Date](#73-set-capture-date)
8. [Sharing and Printing](#8-sharing-and-printing)
   - 8.1 [Publish to Google Photos](#81-publish-to-google-photos)
   - 8.2 [Print](#82-print)
9. [People — Concepts and Browsing](#9-people--concepts-and-browsing)
   - 9.1 [Core Concepts](#91-core-concepts)
   - 9.2 [People in Library](#92-people-in-library)
   - 9.3 [Asset Review Dialog](#93-asset-review-dialog)
   - 9.4 [People Browse](#94-people-browse)
   - 9.5 [Person Detail](#95-person-detail)
10. [People — Review, Quality, and Maintenance](#10-people--review-quality-and-maintenance)
    - 10.1 [People Review Queue](#101-people-review-queue)
    - 10.2 [Scoped People Work](#102-scoped-people-work)
    - 10.3 [Recognition Run Summary](#103-recognition-run-summary)
    - 10.4 [Enrollment and Recognition Quality](#104-enrollment-and-recognition-quality)
    - 10.5 [People Maintenance](#105-people-maintenance)
    - 10.6 [Getting Started with a Large Library](#106-getting-started-with-a-large-library)
11. [Editing Photos](#11-editing-photos)
    - 11.1 [Edit Queue](#111-edit-queue)
    - 11.2 [Edit History](#112-edit-history)
12. [Duplicate Management *(not yet available)*](#12-duplicate-management)
13. [Maintenance](#13-maintenance)
    - 13.1 [Maintenance Dialog](#131-maintenance-dialog)
    - 13.2 [Per-Asset Inspector Actions](#132-per-asset-inspector-actions)
14. [Users and Permissions](#14-users-and-permissions)
    - 14.1 [Roles](#141-roles)
    - 14.2 [Logging In and Managing Your Account](#142-logging-in-and-managing-your-account)
    - 14.3 [What Each Role Can Do](#143-what-each-role-can-do)
    - 14.4 [Admin Tools](#144-admin-tools)

---

## 1. Importing Photos

Photos enter Tedography through the Import dialog. Click the **Import** button (cloud-download icon) in the toolbar to open it.

**Step-by-step:**

**1. Choose a source folder**

The left panel shows your configured storage roots — the top-level directories where your photos live. Click any root to expand it, then navigate into subdirectories to select the folder you want to import from.

**2. Scan the folder**

Click **Scan**. Tedography reads the selected folder and shows you what it found: total files, media files it recognizes, and any files that will be skipped (unsupported formats, already-imported files, etc.).

**3. Assign to an album**

In the right panel, choose where to put the imported photos:
- **No album** — photos are imported without an album assignment
- **Existing album** — pick a destination album from the tree
- **New album** — enter a name; Tedography creates the album under the selected parent group

**4. Register**

Click **Import**. For each photo Tedography:
1. Computes a SHA-256 hash and checks for duplicates
2. Extracts EXIF metadata (capture date/time, camera info, GPS coordinates with reverse-geocoding to city/state/country)
3. Converts HEIC files to display JPEG (stored in the derived root)
4. Generates a JPEG thumbnail
5. Creates a record in the database
6. Schedules the People pipeline for the new asset (if enabled)

**5. After import**

Imported photos appear in Library with the state **New** — the starting point of the review workflow. The import dialog shows a results summary (imported / skipped / errors) before you close it.

**Note:** Import only picks up new files. If you have already-imported photos whose source files have changed (e.g. you moved them on disk), use **Maintenance → Reimport** rather than Import.

---

## 2. Reviewing Photos

### 2.1 Photo States

Every photo in Tedography has one of four states:

| State | Meaning |
|---|---|
| **New** | Freshly imported; not yet reviewed |
| **Pending** | Deferred — you want to decide later |
| **Keep** | Confirmed keeper |
| **Discard** | Rejected — hidden from normal browsing but not deleted |

Photos start as **New**. The review workflow moves them toward **Keep** or **Discard**. **Pending** is a holding state for photos you are not ready to decide on yet. Discarded photos are hidden by default but can be found by searching for the Discard state; the original file is never deleted.

### 2.2 Setting Photo State

With one or more photos selected, use the state buttons in the toolbar (Keep, Pending, Discard, New) or the keyboard shortcuts below. The buttons can be shown as icon-only or with text labels — toggle between the two from **⋯ → Show State Labels / Show Icons Only**.

In **Survey mode** (multi-photo side-by-side view), the state buttons apply to the currently focused photo in the survey, not to the whole selection.

### 2.3 Keyboard Shortcuts

These shortcuts work throughout Library and in Survey and Loupe modes when focus is not in a text field.

**Photo state:**

| Key | Action |
|---|---|
| `s` | Set selected photo to Keep |
| `p` | Set selected photo to Pending |
| `r` | Set selected photo to Discard |
| `Delete` / `Backspace` | Discard (same as `r`; applies to all selected photos if multiple are selected) |
| `u` | Reset selected photo to New |

**Navigation:**

| Key | Context | Action |
|---|---|---|
| `←` `→` `↑` `↓` | Grid | Move selection one cell in that direction |
| `←` `→` | Loupe / Filmstrip | Previous / next photo |
| `Home` | Any | Jump to first visible photo |
| `End` | Any | Jump to last visible photo |
| `Enter` or `Space` | Grid / Loupe | Open the selected photo in the Immersive (full-screen overlay) |
| `Escape` | Immersive open | Close Immersive |
| `Escape` | Survey open | Close Survey |
| `Escape` | Slideshow active | Exit Slideshow |
| `Escape` | Photos selected | Clear selection |
| `Cmd+A` / `Ctrl+A` | Grid | Select all visible photos |

**Immersive overlay navigation:**

| Key | Action |
|---|---|
| `←` `→` | Previous / next photo |
| `s` `p` `r` `u` `Delete` | Same state shortcuts as above |

---

## 3. Viewing and Browsing

### 3.1 Library Browse Modes

The Library has three fundamentally different **browse modes**, switchable from **⋯ → Browse Mode** in the toolbar overflow:

**Timeline** (default) — photos are grouped by capture month, displayed in chronological sections with sticky month/year headers. This is the best mode for a broad chronological view of your archive.

**Albums** — shows photos from whichever albums you have checked in the left sidebar. You can check one album or many. Useful for focused work within a specific event or time period.

**Flat** — all currently visible photos in a single unsectioned grid, with no grouping. Useful when you have filters active and just want a plain list.

### 3.2 Viewing Modes

Within whichever browse mode is active, the toolbar lets you switch how photos are displayed:

| Mode | Description |
|---|---|
| **Grid** | Thumbnail grid — the default browsing view |
| **Loupe** | Single photo, full-size, with arrow-key navigation through the visible set |
| **Filmstrip** | Loupe view with a horizontal strip of thumbnails below for quick jumping |
| **Survey** | Side-by-side comparison of selected photos; each photo can be zoomed independently |
| **Slideshow** | Full-screen auto-advancing playback (see [Section 3.7](#37-slideshow)) |

In Grid and Loupe modes the **Inspector** panel on the right shows metadata for the selected photo: filename, capture date, location, album membership, ordering mode, keywords, people, and per-asset action buttons.

Double-clicking a photo in Grid mode, or pressing `Enter` / `Space`, opens the **Immersive overlay** — a full-screen view of that photo with arrow-key navigation. Press `Escape` to close it.

### 3.3 Selection Behavior

Tedography maintains an ordered list of selected photos.

| Action | Result |
|---|---|
| Single click | Selects that photo only |
| Cmd/Ctrl + click | Adds or removes that photo from the selection |
| Shift + click | Range-selects from the last selected photo to the clicked photo |
| Cmd+A / Ctrl+A | Selects all currently visible photos |
| Long-press (touch) | Enters touch multi-select mode; subsequent taps toggle without needing Cmd/Ctrl |
| Drag across grid | Drag-selects all photos the drag rectangle passes over |

When you use Cmd/Ctrl to build a selection incrementally, photos are added in click order. When you use Shift or Cmd+A, the selection follows the current visible display order. Features that use the selection (e.g. the first photo in Loupe mode) use display order, not click order.

### 3.4 Timeline Navigation and Thumbnail Size

In **Timeline** browse mode, the left sidebar shows a year/month navigator. Each year can be expanded to reveal its months. Click any month entry to scroll the main grid to that section.

**Thumbnail size** is adjustable in Timeline and Albums modes. Open **⋯ → Thumbnail Size** and choose a size level. The setting persists across sessions.

### 3.5 Albums Mode Options

When in **Albums** browse mode with one or more albums checked:

**Presentation** — from **⋯ → Albums Presentation** (or equivalent in the overflow) you can choose:
- **Merged** — all selected albums shown as a single combined grid, sorted by the album ordering rules
- **Grouped by Album** — each checked album appears as its own section with a header showing the album name and photo count

**Album tree sort mode** — controls the order of albums in the left sidebar tree. Choose from **⋯ → Album Sort**:
- **Custom** — the manually assigned order (set via Reorder Up / Down in the context menu)
- **Name** — alphabetical by album name
- **Month/Name** — alphabetical treating names that start with month numbers numerically first

### 3.6 Thumbnail Badges

Photo thumbnails in the grid can show small status badges. The visible badges are:

| Badge | Meaning |
|---|---|
| State badge | Small colored indicator showing Keep (green), Discard (red), or Pending (blue). New photos show no badge. |
| Keyword badge | Indicates the photo has keywords assigned |
| Edit Queue badge | Photo is currently in the (human) Edit Queue — awaiting export/editing |
| Edited import badge | This photo was imported via the Edit Queue as an `_edited` file |
| Has edited version badge | Shown on an original that has one or more edited versions imported from the Edit Queue |
| Edit method badge | Shown alongside the Edited import / Has edited version badges — a sparkle icon for AI-edited, a brush icon for manually edited (Lightroom, Photoshop, etc.); see [11.1 Edit Queue](#111-edit-queue) |
| People badge | Photo has confirmed people data |

Badges can be toggled on or off individually from the toolbar overflow menu under **Badges**.

### 3.7 Slideshow

Slideshow plays photos full-screen with auto-advance. Start it from **⋯ → Slideshow**. If photos are selected, the slideshow plays the selection; otherwise it plays all visible photos.

| Control | Description |
|---|---|
| Play / Pause | Start or pause playback |
| Next / Previous | Move one photo forward or back |
| Skip to first / last | Jump to the beginning or end |
| Adjustable speed | Time per slide (e.g. 2s, 5s, 10s) |
| Loop toggle | Loop continuously or stop at the end |
| Shuffle | Play in random order |
| Info overlay | Shows title, date, location, people, keywords; fades in on hover |
| Progress bar | Position in the slideshow |

**Keyboard shortcuts during slideshow:**

| Key | Action |
|---|---|
| `Space` | Pause / resume |
| `←` `→` | Previous / next |
| `Home` / `End` | First / last |
| `F` | Toggle browser fullscreen |
| `S` | Toggle shuffle |
| `Escape` | Exit slideshow |

Originals are never modified. **Planned for a future release:** transitions (fade, crossfade, Ken Burns), background music, export to video, screensaver mode.

### 3.8 Presentation Mode

**Presentation** is a separate second-window mode designed for displaying photos on an external screen (e.g. a TV). Open it from **⋯ → Present**. A new popup window opens at `/present`.

Drag the presentation window to your TV or external display, then make it fullscreen. As you navigate photos in the main Library window, the presentation window updates automatically to show the currently selected photo. This lets you control what's shown on the big screen from your laptop without the audience seeing your browser UI.

The two windows stay connected via a browser BroadcastChannel — no server round-trips required. Closing the presentation window or the main window ends the connection.

---

## 4. Album Management

### 4.1 Album Tree Structure

The album tree is hierarchical:
- **Groups** are folders that contain albums or other groups. Assets cannot be directly placed in a group.
- **Albums** are leaf nodes that hold photos.

Photos belong to albums, not groups. Groups exist only to organize the tree.

### 4.2 Creating Groups and Albums

**From the toolbar** (when in Library → Albums mode):
- **New Group** — creates a top-level group, or a child group under the currently selected tree node
- **New Album** — creates an album under the currently selected group

**From the album tree context menu** (right-click any node):
- **Create Child Album** — creates an album directly under the right-clicked group
- **Create Top-Level Group** — creates a new root-level group

When importing photos you can also create a new album inline in the Import dialog without leaving it.

### 4.3 Album Tree Context Menu

Right-clicking any album tree node opens a context menu with:

| Action | Description |
|---|---|
| Rename | Edit the album or group label inline |
| Delete | Delete the node; albums must be empty before they can be deleted |
| Move… | Open the Move dialog to reposition this node elsewhere in the tree |
| Reorder Up / Down | Move this node one position within its parent |
| Set Child Order Mode | Set how children of this group are sorted (Custom, Name, NumericThenName) |
| Import Photos Here | Open the Import dialog pre-targeted to this album |
| Manage Writers… | (Admin only) Grant or revoke per-album write access for Limited users |

**Child order modes for groups:**
- **Custom** — children stay in the order you set with Reorder Up / Down
- **Name** — alphabetical by label
- **NumericThenName** — entries that start with numbers sort first numerically, then alphabetically

### 4.4 Moving Albums in the Tree

Right-click a node and choose **Move…** to open the Move dialog. Select the destination parent group (or root level) and confirm. The node and all its contents move to the new location.

You can also reorder siblings within a group using **Reorder Up** and **Reorder Down** from the context menu (when the group's child order mode is Custom).

### 4.5 Album Tree Sort Mode

The left sidebar tree itself can be sorted differently from the child-order-mode of individual groups. Choose from **⋯ → Album Sort** in the toolbar overflow:
- **Custom** — manual order as set in the tree
- **Name** — alphabetical
- **Month/Name** — numeric-month-first, then alphabetical

This affects only the sidebar display order; it does not change where photos appear in the grid.

### 4.6 Album Photo Ordering

Albums use a single interleaved timeline:

- Photos with a capture date sort **chronologically** by default.
- Any photo can be **manually placed** anywhere in the album — including between two dated photos — and it holds that position. Undated photos you haven't placed appear at the end.

When exactly one album is checked and one photo is selected, the Inspector shows the current ordering mode (`Capture Time`, `Manual`, or `Manual (No Capture Time)`), and its Advanced section shows the capture date's provenance (where the date came from, the camera, the date in the file, and the marked-wrong flag).

**Drag and drop** (the primary way to reorder; requires exactly one checked album):
- Drag any thumbnail and drop it onto any other. A blue bar on the target's left or right edge shows whether it lands before or after it. Dropping is what converts a photo to manual placement — no mode switch needed first.
- **Drag a multi-selection as a block**: select several photos, drag any of them, and the whole selection lands together in display order.

**⋯ → Order in Album** (works on multi-selections):
- **Use Manual Order** — pins the selected photos at their current positions (nothing visibly moves).
- **Use Capture Time** — returns the selection to chronological ordering.
- **Arrange by Filename** — reorders the selection by filename sequence (numeric-aware; `(n)` download suffixes group as separate rolls) and keeps it where the selection starts. The roll workflow: select a roll → Arrange by Filename → drag the block into position.
- Move to Top / Up / Down / Bottom — single-photo nudges across the whole album.

**Capture-date trust** (⋯ menu, next to Set Capture Date…):
- **Mark Capture Date Wrong / Correct** — flags the selection's dates as inaccurate (e.g. a camera with a wrong clock) without changing them. Flagged photos count as "suspect" in the ordering badge.

**Ordering badge** (off by default; View badges → Ordering): an amber `!` marks photos with suspect capture dates (weak EXIF pedigree, changed after import, or marked wrong); a blue pin marks photos manually placed in the checked album.

Ordering is album-specific. The same photo can use capture-time in one album and manual placement in another.

### 4.7 Show in Album

When one photo is selected in Library and that photo belongs to an album, the Inspector shows a **Show in Album** link. Clicking it navigates to Albums mode with that album checked and scrolls the grid to the selected photo. Useful for quickly finding where a photo lives in your album tree after navigating to it from Search or a Smart Album.

---

## 5. Organizing Your Library

### 5.1 Keywords

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

- Existing keywords are shown as chips. Click **×** on a chip to remove it.
- Use the **Add Keywords** field to search for and add existing keywords, or type a new name to create one inline. Inline-created keywords are root keywords; reparent them in Maintenance if needed.

When **multiple photos** are selected:
- Only keywords common to all selected photos are shown.
- Adding a keyword applies it to all selected photos.
- Removing a shown keyword removes it from all selected photos.

The Inspector also shows a **Recent Keywords** section — up to 8 keywords you have most recently assigned, shown as clickable chips for fast re-use. Recent keywords are stored locally in your browser.

**Keyword search is hierarchy-aware:**
- Searching for a leaf keyword matches only that keyword.
- Searching for a parent keyword matches that parent and all its descendants.

### 5.2 Smart Albums

Smart Albums are saved searches that reopen a filtered result set with one click.

**Supported filters:**
- Keyword
- Photo state
- Year group

**Creating a Smart Album:**
1. Open **Search** and set the filters you want to save.
2. Click **Save as Smart Album**.

**Managing Smart Albums:**
Open **Maintenance → Smart Albums** to rename, edit, open, or delete any Smart Album.

When a Smart Album is active in Search, the header shows **Smart Album: \<label\>**. If you modify the filters, it changes to **Search (from Smart Album: \<label\>)** — your view has diverged. Use **Exit Smart Album** to return to ordinary search.

Photos are not stored in a Smart Album — it is a saved filter, not a manual album.

---

## 6. Searching

### 6.1 Search Filters

Open **Search** from the top navigation. Available filters:

- **Photo state** — New, Pending, Keep, Discard (select one or more)
- **Album** — one or more albums from the album tree
- **Keyword** — one keyword (hierarchy-aware: parent matches all descendants)
- **People** — one or more confirmed people, with Any or All matching
- **Date range** — From and/or To (capture date)
- **Capture date availability** — filter to photos with a capture date, photos without, or either
- **Edit Queue filters** — five independent filters, each set to Any / Yes / No, combined with a **Match: AND / OR** toggle:
  - **Is manually edited import** — this photo was imported as a manually edited version (Lightroom, Photoshop, etc.)
  - **Is AI edited import** — this photo was imported as an AI-edited version
  - **Has manually edited version** — this original has at least one manually edited version imported from the Edit Queue
  - **Has AI edited version** — this original has at least one AI-edited version imported from the Edit Queue
  - **In edit queue** — photo is currently queued in the Edit Queue

  Set Match to **OR** to combine filters (e.g. "Is manually edited import" + "Is AI edited import" with OR finds any edited import regardless of method); leave it on **AND** (the default) to require all the filters you've set.
- **Filename pattern**
- **Publication status**

**Capture date availability** is especially useful for finding undated photos that may need their date set manually. The three options are:
- **Dated only** — show only photos that have a capture date (default)
- **Undated only** — show only photos with no capture date
- **Dated or undated** — show all photos regardless of date

When a keyword filter is active, a **Keyword: …** chip appears above the results. Clear it with the chip's remove control or **Clear Keyword**.

The results header shows context:
- **Search** — ordinary ad hoc search
- **Smart Album: \<label\>** — an exact saved Smart Album
- **Search (from Smart Album: \<label\>)** — a search derived from a Smart Album with modified filters

### 6.2 People Search

The **People** section in Search lets you find photos by confirmed person data and face-review state.

| Filter | What it finds |
|---|---|
| Has person | Photos where one selected person is confirmed |
| Has any of these people | At least one of the selected people is confirmed (Match: Any) |
| Has all of these people | Every selected person is confirmed in the same photo (Match: All) |
| Has no confirmed people | Photos with no confirmed people data yet |
| Has reviewable faces | Photos that still have unresolved face detections needing review |

**Examples:**
- *Show me photos with Lori* — select Lori
- *Show me Ted and Lori together* — select both, set Match: All
- *Show me photos that still need people review* — enable Has reviewable faces

### 6.3 Natural Language Search

The Search panel includes a natural language input at the top. Type a plain-English description and press Enter. Tedography translates the query into search filters using Claude AI and overlays the result onto your current filters — only the fields Claude could identify in your query are changed.

Examples:
- *Show me kept photos of Lori from Hawaii*
- *Find photos from 2019 with the keyword Nature*
- *Photos that are still pending review*

### 6.4 Show in Library from Search

When you have one or more photos selected in Search results, the toolbar shows a **Show in Library** button (library/album icon). Clicking it:

1. Switches to Library → Albums mode
2. Checks the album(s) that contain the selected photos
3. Scrolls to the first selected photo

This is useful for finding out where a search result lives in your album tree, or for doing album-context work (like reordering) on a photo you found via search.

---

## 7. Photo Adjustments

### 7.1 Rotate

Select one or more photos and use the **Rotate** controls in the toolbar (or the Inspector). Three options are available:

- **Rotate Clockwise** — 90° clockwise
- **Rotate Counterclockwise** — 90° counterclockwise
- **Rotate 180°** — flip upside down

Rotation is a non-destructive metadata operation — the original file is updated in-place and derived files (display JPEG and thumbnail) are regenerated. Multiple selected photos are all rotated simultaneously.

### 7.2 Crop

Crop is available from the toolbar when one photo is selected. Clicking **Crop** opens the photo's source file in **macOS Preview**.

Make your crop in Preview and save the file (`Cmd+S`). Tedography watches the file for changes. When it detects the save, it updates the asset's stored file and regenerates the display JPEG and thumbnail automatically. Close Preview when you are done.

**Important:** Crop modifies the original source file on disk. It is a destructive operation. Tedography does not keep a copy of the pre-crop original unless you export one beforehand via the Edit Queue.

### 7.3 Set Capture Date

If a photo has a missing or incorrect capture date, you can set it manually. Select one or more photos and choose **⋯ → Set Capture Date…**.

In the dialog you can:
- Enter a date and time to assign as the capture date
- Clear the capture date entirely

Setting a capture date affects how the photo appears in Timeline mode and how album ordering works for that photo. The change is written to the database; the original file's EXIF data is not modified.

---

## 8. Sharing and Printing

### 8.1 Publish to Google Photos

Click the **Publish** button in the toolbar (or **⋯ → Publish to Google Photos**) to upload photos to a new Google Photos album.

**Steps:**

1. **Connect** — on first use, authorize Tedography to access your Google Photos account.
2. **Configure the upload:**
   - **Album title** — the name for the new Google Photos album
   - **Source** — upload the current selection, or all photos in the current view
   - **Upload version** — Original file (HEIC originals fall back to the display JPEG when the original cannot be uploaded), or Display JPEG (always converts to JPEG)
3. Click **Publish**. Tedography uploads the photos and creates the album.

To share the resulting album, open it in Google Photos and use the Share button there — Tedography does not manage sharing links directly.

### 8.2 Print

Click the **Print** button in the toolbar (or **⋯ → Print**) with one or more photos selected.

**Steps:**

1. **Choose a print provider** — select a provider from the list.
2. **Configure defaults** — set the default size, finish, and quantity that apply to all photos in this order.
3. **Per-photo adjustments** — each photo is listed with its own size/finish/quantity controls. You can also set a crop mode for each photo (fill vs. fit).
4. **Review and order** — click **Order** to export the photos to the print provider, or **Go to Crop** if you want to adjust crops before ordering.

The Print feature is subject to role-based permissions. Limited users can print only in albums where they have been granted write access.

---

## 9. People — Concepts and Browsing

### 9.1 Core Concepts

Tedography uses three related but distinct concepts for People:

**Confirmed face detection** — a specific detected face in a specific photo has been reviewed and confirmed as belonging to a person. This is the atomic unit of people data.

**Example face** — a confirmed face that is also being used as a reference to improve future recognition. Not every confirmed face needs to become an example.

**Asset people** (`mediaAsset.people`) — the confirmed people list for a whole photo, derived from confirmed detections. This is the trusted result used by Search and the Inspector.

The key rule: **confirmed = trusted; reviewable = still needs work.** Only confirmed data flows into search results and the Inspector's people list.

### 9.2 People in Library

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

### 9.3 Asset Review Dialog

From Library, clicking **Review Faces** opens an in-context review dialog for the selected photo.

**Actions available per face:**
- Confirm suggested/current person
- Reject a wrong suggestion
- Assign to an existing person
- Create a new person and assign
- Ignore a face
- Add a confirmed face as an example

**Optional face boxes:** Enable **Show Face Boxes** to overlay colored bounding boxes on the source image. The box for the currently selected review card is highlighted. Clicking a box selects its review card. Colors indicate status: Confirmed, Suggested, Auto Matched, Unmatched, Rejected, Ignored.

Use the in-context dialog for one-photo review while staying in Library. Use the **standalone People Review page** when you want to work through many photos at once.

### 9.4 People Browse

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

Clicking **View Photos** on a person card opens the main app in Search with that person applied as a People filter.

### 9.5 Person Detail

Each person has a detail page at `/people/:personId`. Reach it by clicking any person card in People Browse.

**The page shows:**
- Display name, representative image, confirmed photo count, last-seen date
- Review-needed count (unresolved faces still associated with this person)
- A grid of confirmed photos
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
- **Split Selected Faces** — move a subset of confirmed faces to a different person (see [Section 10.5](#105-people-maintenance))
- **Merge Person** — merge this person record into another (see [Section 10.5](#105-people-maintenance))
- **Reprocess Related Assets** — re-run recognition on a bounded set of recent confirmed assets for this person

---

## 10. People — Review, Quality, and Maintenance

### 10.1 People Review Queue

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

### 10.2 Scoped People Work

Rather than processing your entire library at once, use **People Scope** to work on a manageable subset.

**Available scopes:**
- Current Library selection
- Checked album(s) in Library Albums mode
- Current Search results
- Search date-range scope (when From and/or To are set)

**To start scoped work:**
1. In Library, select assets — or switch to Albums mode and check albums — or go to Search and set filters.
2. Click **People Scope** in the toolbar.
3. The dialog shows: scope type, scope label, asset count, confirmed people count, reviewable faces count.
4. Choose an action:
   - **Run People Recognition** — detect and match faces for the scope
   - **Reprocess People Recognition** — re-run recognition on already-processed assets
   - **Review Faces In Scope** — open People Review filtered to this scope

For large scopes, the dialog asks for confirmation before processing.

### 10.3 Recognition Run Summary

After **Run People Recognition** or **Reprocess People Recognition** completes, Tedography shows a **People Recognition Run Summary** dialog.

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

"No faces detected" ≠ "Not processed" — the former means the engine ran and found nothing; the latter means it did not run at all.

**Action buttons:**
- **Review Suggested Matches (n)** — go to People Review for suggested-match assets
- **Review Unmatched Faces (n)** — go to People Review for unmatched-face assets
- **Review Ignored Faces (n)** — go to People Review for ignored-face assets
- **Show No-Face Assets (n)** — select no-face assets in the current grid
- **Show Failed Assets (n)** — select failed assets in the current grid
- **Return to Album** — dismiss

The summary persists across navigation. If you click **Review Suggested Matches** and return to Library, the summary reappears. It is cleared only when explicitly dismissed.

### 10.4 Enrollment and Recognition Quality

Every confirmed face *can* be promoted to an **example face** that the recognition engine uses to improve future matching.

**Enrollment status on Person Detail:**
- `Not enrolled` — no example faces yet
- `Enrolled: N examples` — actively used examples
- `Enrolled: N examples (thin set)` — very few active examples

**Adding an example:**
1. Confirm a face as belonging to a person.
2. Click **Add As Example** (available in People Review, the asset review dialog, and Person Detail).
3. The action is idempotent — clicking the same confirmed face multiple times does not create duplicates.

**Removing a bad example:**
From Person Detail, click the remove control on an example face. This removes it from recognition enrollment but does not erase the original confirmed detection.

**Reprocessing after example changes:**
Use **Reprocess Related Assets** on Person Detail to re-run recognition on a bounded set of recent confirmed assets. This is intentionally scoped — it is not a full-library reprocess.

### 10.5 People Maintenance

#### Merge Duplicate People

Use **Merge Person** on Person Detail when two person records represent the same real person.

- The target person survives.
- Confirmed detections from the source are reassigned to the target.
- Example faces from the source are moved to the target when possible.
- The source person is hidden and archived (not deleted).

#### Split Person

Use **Split Selected Faces** on Person Detail when a person record is mostly correct but some confirmed faces belong to a different person.

1. In **Confirmed Faces**, check the faces you want to move.
2. Click **Split Selected Faces**.
3. Choose an existing destination person or enter a new person name.
4. Confirm.

#### Reassign or Remove a Confirmed Face

Individual confirmed faces on Person Detail support:
- **Reassign** — move this face to another person
- **Remove from Person** — remove the confirmation (updates the asset's derived people list)
- **Add as Example** — promote to an example face

### 10.6 Getting Started with a Large Library

Work in small, inspectable chunks — do not run People recognition across thousands of photos in one pass.

**Good starting scopes:** one small album, one trip, one year/month date range.

**Recommended first pass:**
1. Pick a small familiar scope. Use **People Scope**.
2. Run **Run People Recognition**.
3. Open **Review Faces In Scope**.
4. Confirm only people you are confident about.
5. For important people, add a few clean confirmed faces as examples (sharp, front-facing, well-lit).
6. Reject wrong suggestions. Ignore non-useful faces.

**After each chunk:**
- In Search, filter by a person and spot-check that returned photos really contain them.
- Use **Has no confirmed people** to find photos that may still need processing.
- Use **Has reviewable faces** to find photos with unresolved detections.
- On Person Detail, check example faces before reprocessing more assets.

**Hide vs. Archive:**
- **Hidden** — excluded from normal People Browse unless "Show hidden people" is enabled.
- **Archived** — treated as inactive in People Browse unless "Show archived people" is enabled.

Neither deletes the person or removes them from confirmed photos.

---

## 11. Editing Photos

### 11.1 Edit Queue

The Edit Queue exports original photos to an external folder so you can edit them in any tool — a traditional editor (Lightroom, Photoshop, etc.) or an AI tool — then imports the results back into Tedography. Imported files inherit key metadata from their source. There's no limit on how many edited versions an original can have — for example, several manual edits and several AI edits can all coexist. Note that the thumbnail badge only shows one indicator per method (Manual / AI) regardless of how many versions of that method exist; to see the actual count, use Search or browse the album.

**Setup:** add to `apps/api/.env`:
```
TEDOGRAPHY_EDIT_PATH=/absolute/path/to/your/edit/folder
```
The folder is created automatically. The path must be within one of your registered storage roots.

**Workflow:**

**1. Add to queue** — Select a photo and click the **Add to Edit Queue** toolbar button. Optionally add an editing note, then confirm. This button is grayed out whenever the selected photo is already in the queue — that's not an error, it just means there's nothing to add. To update an existing note, or to re-export/re-import for a photo already queued, select it and use **Open Queue** or **Edit Note** from the **Edit Queue** toolbar menu (brain icon) instead.

**2. Export** — Open the **Edit Queue** dialog (**Open Queue** from the same toolbar menu). Check the photos to export and click **Export (N)**. Tedography copies the originals to your edit folder and writes `notes.txt`, and merges into `manifest.json` (do not delete or rename it). Exporting a different subset later adds/updates entries rather than replacing the file, so an original you exported previously — and haven't imported its edit for yet — stays matchable even if it's no longer checked (or no longer in the queue at all) in a later export. Entries are only ever cleared out by **Clear Edit Folder**, which deletes `manifest.json` along with everything else in the folder.

In the Edit Queue dialog's list, a photo's filename normally links in blue. A green **✓** next to it means that photo currently has a `manifest.json` entry — it's been exported and is linked, ready for Import to pick up an edit once you produce one. No checkmark just means it hasn't been exported yet (or not since the queue was last cleared) — not a problem on its own.

If the filename turns **amber** instead, there's an `_edited` file already sitting in the folder for it that Import can't currently see — its manifest link is missing (most often because it hasn't been exported since a manifest overwrite predating the fix above, or it was never exported at all after producing the edit). Hover the filename to see which file(s) are stuck; checking the box and clicking **Export** again restores the link. A queued photo is never both checkmarked and amber at once — if it's currently linked, any edit for it would already be matched, not stuck.

**3. Edit externally** — Open the exported files in any tool. Save results with the naming convention `<originalBasename>_edited.<ext>` (e.g. `IMG_1234_edited.jpg`), and save to the same edit folder. To produce more than one edited version of the same original (e.g. a manual edit and an AI edit), give each a distinct filename that still starts with `<originalBasename>_edited` — for example `IMG_1234_edited_ai.png` and `IMG_1234_edited_manual.jpg`.

**4. Import** — Back in the Edit Queue dialog, click **Import Edited Files**. This button shows a live count of matched files and is disabled (with "No `_edited` files found in edit folder") whenever the folder has none — it scans the whole edit folder, independent of which queue entries are checked; the queue's checkboxes only scope Export and Clear Queue. If matches are found, a **Classify Edited Files** dialog opens before anything is imported:

- Every listed file is checked by default. Uncheck any you don't want to import in this pass — for example if one edit needs more work — and its **Manual / AI** toggle grays out while unchecked. A **Select all** checkbox and a **Set all to** batch toggle (Manual/AI) apply to the whole list. Since this list is built only from files the scan actually matched to a source, you can never select something with no corresponding `_edited` file — deselecting only removes files from *this* import batch, it never deletes them.
- Click **Confirm Import (N)** to commit the checked files (disabled when nothing is checked). Each imported file becomes a new asset inheriting:

| Property | Source |
|---|---|
| Album memberships | Copied from original |
| Keywords | Copied from original |
| Location | From edited file EXIF if present; otherwise from original |
| Capture date/time | From edited file EXIF if present; otherwise from original |
| People tags | Copied from original |
| Photo state | Always starts as **New** |
| Edit method | As classified in the dialog — shown as a badge (sparkle = AI, brush = Manual) on both the new asset and the original |

As part of import, the edited file is **moved** (not copied) out of the edit folder into the same folder on disk as its source original, keeping its `_edited` filename. It no longer exists in the edit folder afterward. The source original itself is never modified or moved — but the *exported copy* of it that Export placed in the edit folder in step 2 is untouched by import and is left behind there. If you classify a file incorrectly, open the edited asset and change **Edit Method** in the Inspector — no need to re-import.

Each queue entry is automatically removed once its file is successfully imported — there's no manual cleanup step for completed items.

**5. Clean up** — To remove a single queue entry without touching the rest of the queue, click the **×** next to that entry in the Edit Queue dialog (this only removes the queue entry — it never touches any file). To remove every queue entry at once, use **Clear Queue** (requires confirmation, either a **Clear entire queue?** inline prompt in the dialog or a confirmation dialog from the toolbar menu).

The dialog also shows an **Edit Folder Files** list — every file currently sitting in the edit folder (exported originals, `manifest.json`, `notes.txt`, and any not-yet-imported edited files), refreshed automatically after Export, Import, and Clear Edit Folder. Click the **×** next to any single file to delete just that one (confirmation required) — useful for discarding one bad export or edit without wiping the whole folder. This list is also where stray OS artifacts show up (e.g. macOS `._filename` AppleDouble files created when copying to certain volumes) — safe to delete individually here.

**Clear Edit Folder** (two-step confirmation) is separate and file-based: it deletes **every file** left in the edit folder in one shot — the exported copies of your originals from step 2 (since successfully-imported edited files are already gone, moved out in step 4), `manifest.json`, `notes.txt`, and also any edited file you haven't imported yet. Use the per-file **×** above instead when you only want to remove one file.

**Import result statuses:**

| Status | Meaning |
|---|---|
| `imported` | Successfully created a new asset |
| `skipped` | No matching manifest entry, or unsupported format |
| `error` | Import failed (duplicate, missing storage root, etc.) |

### 11.2 Edit History

Every file processed by Import (succeeded or failed) is recorded in **Edit History**. Open it from **Edit Queue → View Edit History**.

The Edit History dialog shows each entry with its source filename, edited filename, import status, and a Note field. You can **edit the Note** on any entry (click the ✎ button) to record what you actually did during editing. Notes are saved to the database immediately.

**Edit History Archives** let you move completed entries out of the active list into named, read-only archives. From the Edit History dialog:
- Select one or more entries and click **Archive Selected** to move them into a new or existing archive.
- Use **View Archives** to open the archives list, browse entries in any archive, rename an archive, append more entries to it, or delete it entirely.

Archives are useful for keeping the active Edit History list focused on recent work while preserving the full record of past edits.


---

## 12. Duplicate Management

> **Not yet available.** Duplicate detection tooling exists in the codebase (`apps/duplicate-cli`, `apps/duplicate-worker`, `apps/duplicate-review-web`) but is not integrated into the main Tedography app. The CLI can scan assets and generate candidate pairs; the review web app is currently a placeholder. This feature is planned for a future release.

---

## 13. Maintenance

### 13.1 Maintenance Dialog

Open the **Maintenance** dialog from **⋯ → Maintenance** (Admin only). It provides folder-level operations for keeping already-imported assets healthy.

**Source Browser (left panel)**

Navigate your storage roots to select a target folder. Maintenance only operates on already-known assets — for new files, use Import.

**Verify Known Assets in Folder** — scans the selected folder and checks that each known asset's source file and derived files (display JPEG, thumbnail) are present and intact. Non-mutating: nothing is changed. Results list each asset with its verification status.

**Reimport Known Assets in Folder** — re-reads the source files for all known assets in the selected folder and updates their metadata (EXIF, dimensions, location, etc.) from the current file state. Use this after moving files on disk or after external metadata changes. Mutates existing asset records.

**Rebuild Derived Files in Folder** — regenerates the display JPEG and thumbnail for all known assets in the selected folder. Use after derived files become corrupted or after rotating images that need their thumbnails refreshed. Mutates derived files.

**Smart Albums** — the Maintenance dialog also contains the Smart Albums management section (create, rename, edit, delete saved Smart Albums).

**Keyword Hierarchy** — accessible from the Maintenance dialog: create, rename, reparent, and organize your keyword tree.

### 13.2 Per-Asset Inspector Actions

When one photo is selected, the Inspector includes two asset-level maintenance actions (Admin only):

**Reimport** — re-reads this specific asset's source file and updates its metadata record. Equivalent to the folder-level reimport but for a single asset.

**Rebuild Derived Files** — regenerates the display JPEG and thumbnail for this specific asset.

Both actions are available directly in the Inspector without opening the full Maintenance dialog, making them convenient for fixing individual assets you notice while browsing.

---

## 14. Users and Permissions

### 14.1 Roles

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

Custom roles can be created with any combination of permissions.

### 14.2 Logging In and Managing Your Account

A login screen appears before the application loads. Select your name from the list and enter your PIN.

Once logged in:
- Your **name** appears in the top-right corner of the toolbar.
- **Log out** ends your session and returns to the login screen.
- **Change PIN** opens a dialog to update your PIN. You must supply your current PIN; the new PIN must be at least 4 characters.

### 14.3 What Each Role Can Do

**All users** (regardless of role):
- See the login screen and log in
- Change their own PIN

**Limited users** see locked albums (🔒 icon) where they have no write access. Controls for state changes, moving/removing photos, rotating, printing, and people review are enabled only in albums they have been explicitly granted write access to. Import, keyword management, and maintenance tools are hidden entirely.

**Full users** have access to all features except Maintenance. The Maintenance menu item and the Reimport/Rebuild Derived Files buttons in the Inspector are hidden.

**Admin users** have access to all features, including Maintenance, all import operations, and user/role management.

### 14.4 Admin Tools

**Managing album writers:**
Right-click any album in the album tree and choose **Manage Writers…**. This dialog shows Admin and Full users (always have access) and lets you grant or revoke write access for Limited users on that album.

**Users page (`/admin/users`):**
Accessible from **⋯ → Users** for Admin users only.
- View all users (name, role, ID)
- Change a user's role — select a new role in the inline dropdown and click Save; an admin cannot change their own role
- Create a user — enter display name, role, and initial PIN (minimum 4 characters)
- Delete a user — click × and confirm; an admin cannot delete their own account

**Roles page (`/admin/roles`):**
Accessible via **Manage Roles →** in the Users page header. Shows every role as a card with a full permission grid. Click **Edit** to modify a role's name and permissions inline. The three built-in roles (admin, full, limited) can be edited but not deleted. Custom roles can be deleted when no users are assigned to them.
