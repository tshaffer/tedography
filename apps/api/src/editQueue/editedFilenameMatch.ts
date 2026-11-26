import { basenameWithoutExt, type ManifestEntry } from './manifest.js';

// A finished edit is named  <original basename>[Adobe tokens]_edited[suffix].<ext>
//
//   IMG_2579_edited.tif            Lightroom-only edit
//   IMG_2579_edited_v2.tif         further version (any suffix without "_edited")
//   IMG_2579-Edit_edited.tif       Photoshop round trip
//   IMG_2579-Edit-2_edited_v2.tif  second Photoshop derivative
//
// "Adobe tokens" are the derivative suffixes Lightroom Classic appends to the
// working file it creates: -Edit, -Edit-N (Edit in Photoshop), -Enhanced,
// -Enhanced-NR / -Enhanced-SR (Enhance), -HDR, -Pano. Matching is on this
// explicit grammar, never on a bare prefix or substring.
//
// The `_edited` marker is the LAST one in the name: whatever follows it is a
// version suffix and cannot itself contain `_edited`. That keeps chained edits
// unambiguous — IMG_4516_edited_ai_edited.tif is an edit of the asset named
// IMG_4516_edited_ai, not a second edit of IMG_4516.

const EDITED_MARKER = '_edited';
const ADOBE_TOKENS = /^(?:-edit(?:-\d+)?|-enhanced(?:-nr|-sr)?|-hdr|-pano)+$/;
const TRAILING_ADOBE_TOKENS = /(?:-edit(?:-\d+)?|-enhanced(?:-nr|-sr)?|-hdr|-pano)+$/i;

/** Files that are never edit output: macOS metadata, hidden files, our own bookkeeping. */
export function isIgnoredFolderFile(filename: string): boolean {
  return filename.startsWith('.') || filename === 'Thumbs.db' || filename === 'desktop.ini';
}

/** The part of the filename before its last `_edited` marker, or null if it has none. */
export function extractEditedStem(filename: string): string | null {
  if (isIgnoredFolderFile(filename)) {
    return null;
  }
  const base = basenameWithoutExt(filename);
  const index = base.toLowerCase().lastIndexOf(EDITED_MARKER);
  if (index <= 0) {
    return null;
  }
  return base.slice(0, index);
}

/** The stem with any trailing Adobe derivative tokens removed — the likely original basename. */
export function inferOriginalBasename(filename: string): string | null {
  const stem = extractEditedStem(filename);
  if (stem == null) {
    return null;
  }
  const stripped = stem.replace(TRAILING_ADOBE_TOKENS, '');
  return stripped.length > 0 ? stripped : stem;
}

export type FilenameMatch =
  | { kind: 'ignored' }
  | { kind: 'unmatched' }
  | { kind: 'matched'; entry: ManifestEntry }
  | { kind: 'ambiguous'; candidates: ManifestEntry[] };

function entryMatchesStem(entry: ManifestEntry, stemLower: string): boolean {
  const originalLower = entry.originalBasename.toLowerCase();
  if (originalLower.length === 0 || !stemLower.startsWith(originalLower)) {
    return false;
  }
  const remainder = stemLower.slice(originalLower.length);
  return remainder.length === 0 || ADOBE_TOKENS.test(remainder);
}

export function matchEditedFilename(filename: string, entries: ManifestEntry[]): FilenameMatch {
  const stem = extractEditedStem(filename);
  if (stem == null) {
    return { kind: 'ignored' };
  }
  const stemLower = stem.toLowerCase();
  const candidates = entries.filter((entry) => entryMatchesStem(entry, stemLower));
  const distinct = new Map(candidates.map((entry) => [entry.sourceAssetId, entry]));
  if (distinct.size === 0) {
    return { kind: 'unmatched' };
  }
  if (distinct.size > 1) {
    return { kind: 'ambiguous', candidates: Array.from(distinct.values()) };
  }
  return { kind: 'matched', entry: Array.from(distinct.values())[0]! };
}
