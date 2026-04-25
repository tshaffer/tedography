# Keywords In Tedography

This document describes how keywords currently work in Tedography from the user perspective.

It covers:

- what keywords are for
- how to create and organize them
- how to rename them
- how to assign them to photos
- how to search by them
- how Smart Albums use keywords
- current limitations

## What Keywords Are

Keywords are descriptive metadata attached to photos.

They are separate from albums.

That means a photo can:

- be in `Unfiled`
- be in `Miscellany`
- be in a curated album
- and also have zero or more keywords

Keywords are intended to describe content across albums and years.

Examples:

- `People / Lori`
- `People / Joel`
- `Nature / Flowers`
- `Places / Hawaii`
- `Activities / Hiking`

## Flat And Hierarchical Keywords

Tedography now supports hierarchical keywords.

A keyword can either be:

- a root keyword, such as `People`
- or a child keyword, such as `People / Lori`

Existing older keywords still work. If they do not have a parent, they are treated as root keywords.

## Current Uniqueness Rule

Keyword names are globally unique after normalization.

In practice this means:

- `Flowers`
- ` flowers `
- `FLOWERS`

are all treated as the same keyword.

It also means you cannot currently have two different keywords with the same label in different branches, such as:

- `Nature / Flowers`
- `Decor / Flowers`

Only one normalized `Flowers` keyword can exist in the system.

## Where To Manage Keyword Hierarchy

Keyword hierarchy is currently managed in the `Maintenance` dialog.

Open:

1. `Maintenance`
2. `Keyword Hierarchy`

From there you can:

- create a root keyword
- create a child keyword under the selected keyword
- rename an existing keyword
- move a keyword under a different parent
- clear a parent to make a keyword a root keyword again

## Keyword Hierarchy UI

The `Keyword Hierarchy` section shows:

- a tree of current keywords
- the currently selected keyword
- controls for creating, renaming, and reparenting keywords

### Create A Root Keyword

Use `Create Root Keyword` when you want a top-level category such as:

- `People`
- `Places`
- `Nature`
- `Activities`

### Create A Child Keyword

Select a keyword in the tree first, then use `Create Child Keyword`.

Example:

1. Select `People`
2. Enter `Lori`
3. Create child

Result:

- `People / Lori`

### Reparent A Keyword

Select a keyword, then use `Reparent Selected Keyword`.

You can:

- choose another keyword as its parent
- or choose `None (root keyword)` to move it back to the top level

Tedography prevents:

- making a keyword its own parent
- moving a keyword under one of its descendants

## Renaming Keywords

Keyword rename is also handled in `Maintenance -> Keyword Hierarchy`.

Select a keyword, then use `Rename Selected Keyword`.

Rename updates the keyword in place:

- the same keyword id is preserved
- existing asset associations stay intact
- parent/child relationships stay intact
- the new label appears everywhere that keyword is shown

Rename uses the same normalization and uniqueness rules as keyword creation.

That means:

- whitespace is trimmed and normalized
- empty labels are rejected
- renaming to a label that would collide with another existing keyword is rejected

Tedography does **not** auto-merge duplicate keywords during rename.

## Assigning Keywords To Photos

Keywords are assigned in the right-side `Inspector`.

Select:

- one photo, or
- multiple photos

Then use the `Keywords` section.

### Single Photo

When one photo is selected:

- the inspector shows that photo’s current keywords
- keywords appear as chips
- clicking the `x` on a chip removes that keyword from the photo

To add keywords:

1. use the `Add Keywords` field
2. select an existing keyword from the list, or type a new one
3. add it to the photo

### Multiple Photos

When multiple photos are selected:

- the inspector shows only the keywords common to all selected photos
- adding a keyword applies it to all selected photos
- removing a shown keyword removes it from all selected photos
- the panel makes it explicit that the displayed list is the common intersection

This is intentionally a simple first bulk-edit workflow, not a full metadata diff view.

## How Hierarchy Appears During Assignment

Keyword pickers now show hierarchical path labels instead of only the leaf label.

Examples:

- `People / Lori`
- `Nature / Flowers`
- `Places / Hawaii`

This helps distinguish context when selecting a keyword.

Keyword chips in the inspector also show the full path label.

## Recent Keywords

The inspector keyword panel also keeps a `Recent Keywords` area for faster repeated assignment.

Behavior:

- when you successfully add a keyword to one or more photos, that keyword becomes recent
- recent keywords are shown as clickable chips
- clicking a recent keyword chip adds it to the current selection immediately

This is especially useful when tagging many photos with the same few keywords.

Current behavior details:

- recent keywords are stored locally in your browser
- they are not currently synced between devices or browsers
- the recent list is ordered most-recent-first
- Tedography currently keeps up to 8 recent keywords

Because recents are stored by keyword id, keyword rename works naturally there too: a renamed keyword will show its new label after the keyword list refreshes.

## Creating Keywords During Assignment

You do not need to pre-create every keyword in Maintenance.

When assigning keywords in the inspector:

- you can select an existing keyword
- or type a new keyword and create it inline

Inline-created keywords are created as root keywords.

If you want that keyword to become a child of another keyword, use `Maintenance -> Keyword Hierarchy` afterward to reparent it.

## Searching By Keyword

Keyword search is currently available in the `Search` area.

Open:

1. `Search`
2. use the `Keyword` filter

You can:

- search for an existing keyword by label
- select one keyword
- view the matching photos in the normal Search results grid
- clear the keyword filter without leaving Search

## Search Semantics

Keyword search is hierarchy-aware.

### Leaf Keyword Search

If you search for a leaf keyword, Tedography matches that keyword only.

Example:

- searching for `Nature / Flowers`

matches photos tagged with:

- `Nature / Flowers`

but not photos tagged only with:

- `Nature`
- `Nature / Gardens`

### Parent Keyword Search

If you search for a parent keyword, Tedography includes that parent and all of its descendants.

Example:

- searching for `Nature`

matches photos tagged with:

- `Nature`
- `Nature / Flowers`
- `Nature / Gardens`
- any other descendant of `Nature`

This is the main payoff of hierarchy right now.

## Active Keyword Filter Display

When a keyword filter is active in Search:

- the selected keyword is shown in the Search panel
- the active keyword also appears in the results chrome as a `Keyword: ...` chip
- you can clear it with the remove control or `Clear Keyword`

Search also shows a current context label above the results:

- ordinary ad hoc Search appears as `Search`
- an exact saved Smart Album appears as `Smart Album: <label>`
- a Search that started from a Smart Album but no longer exactly matches it appears as `Search (from Smart Album: <label>)`

This context label is separate from the keyword chip. A keyword chip tells you which keyword filter is active; the context label tells you whether you are looking at ordinary Search results, a saved Smart Album, or a Search derived from a Smart Album.

## Smart Albums

Tedography now supports `Smart Albums` as saved searches.

For keywords, the important point is:

- a Smart Album can save a keyword-based Search
- opening that Smart Album later reopens Search with the saved filters
- Smart Albums are separate from the manual album tree

In this first slice, Smart Albums support a limited filter set:

- keyword
- photo state
- year group

### Saving A Keyword-Based Smart Album

Open `Search` and set a supported combination of filters, for example:

- `Keyword = Places / Hawaii`
- optionally `Photo State = Keep`
- optionally `Year Group = 1998`

Then use `Save as Smart Album`.

### Opening And Managing Smart Albums

Smart Albums are managed in `Maintenance -> Smart Albums`.

From there you can:

- open a Smart Album in Search
- rename its label
- change its saved supported filters
- delete it

When a Smart Album is active in Search:

- Search shows `Smart Album: <label>` when the current results exactly match the saved filters
- the normal asset grid shows the matching results
- `Exit Smart Album` clears that saved-search view

If you open a Smart Album and then edit Search filters:

- before running Search, Tedography shows `Search (from Smart Album: <label>)` with pending changes
- after running Search with filters that no longer match the saved Smart Album, Tedography keeps the `Search (from Smart Album: <label>)` label and marks it as a derived Search
- `Exit Smart Album` clears that Smart Album origin and returns you to ordinary ad hoc Search

This distinction matters because Smart Albums are saved derived views, not manual albums. Photos are not stored in a Smart Album, and album membership actions still target manual albums.

In `Maintenance -> Smart Albums`, Smart Albums are labeled as saved filters. The open action is `Open Saved Filters in Search`.

## Current Limitations

This is the current first hierarchical slice. Tedography does **not** yet support:

- keyword synonyms
- automatic tagging
- multi-keyword boolean search such as AND / OR queries
- drag-and-drop keyword tree editing
- inline parent selection when creating a keyword from the inspector
- duplicate labels in different branches
- Smart Albums using every Search filter
- nested smart-album logic

## Recommended Current Workflow

For practical use right now:

1. Create top-level categories in `Maintenance -> Keyword Hierarchy`
2. Add child keywords under those categories as needed
3. Assign keywords from the inspector while reviewing or browsing photos
4. Use `Search -> Keyword` to retrieve photos by keyword
5. Use parent keywords when you want broader retrieval across a category
6. Save your most useful keyword searches as `Smart Albums`

## Example Setup

A simple starting hierarchy could be:

- `People`
- `People / Lori`
- `People / Joel`
- `Places`
- `Places / Hawaii`
- `Places / Filoli`
- `Nature`
- `Nature / Flowers`
- `Nature / Gardens`
- `Activities`
- `Activities / Hiking`

This gives you:

- broad category search, such as `People`
- specific search, such as `Places / Hawaii`
- keyword assignment that still fits the current Tedography workflow cleanly
- reusable saved keyword views through Smart Albums
