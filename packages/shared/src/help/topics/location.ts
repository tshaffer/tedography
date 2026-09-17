import type { HelpTopic } from '../types.js';

export const location: HelpTopic = {
  slug: 'location',
  title: 'Location',
  category: 'Organizing',
  order: 4,
  keywords: ['location', 'place', 'GPS', 'map', 'geocode', 'default location', 'fill missing locations'],
  body: `Tedography reads GPS coordinates from a photo's EXIF at import and reverse-geocodes them into a city/state/country. Coordinates are stored, but you'll never see raw numbers in the app — only a place name, or nothing at all if none is known.

**Set Location (Inspector / toolbar ⋯ → Set Location…):** search for a place by name — type-ahead is powered by Google Places, so partial names work. Applies to the current selection (one photo, or many at once — they all get the same place). Choose **Clear location** to remove it instead. A manually-set location shows a green **Manual** badge and won't be overwritten by re-import or the location backfill scripts.

**Suggested from a nearby photo:** when a photo has no location, the Inspector shows an inline suggestion if another photo in the same album — nearest in capture time — has one. **Apply** to accept it (marked with an "inherited" badge), or **Dismiss** to ignore it for this photo.

**Fill Missing Locations (album right-click menu):** the bulk version of the same suggestion — scans every location-less photo in an album at once, shows each one's best match (or "No nearby match found"), and lets you apply them individually or all at once with **Apply All Matches**.

**Album default location (album right-click menu → Set Default Location…):** set once on an album — e.g. an album named after a trip or event. Any photo in that album with no location of its own shows the album's default, labeled **From album**, without ever being written onto the photo. A photo's own EXIF location or a manually-set location always takes priority.

**Search and Smart Albums by place:** the Search panel's **Location** filter matches photos by city, state, country, or the raw EXIF location label. Save a search that includes a location filter as a Smart Album the same way you would any other — it shows up in the sidebar for one-click access later.`,
};
