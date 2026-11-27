import { TRAILING_ADOBE_TOKENS, codedPrefix, endsWithExportCode } from './exportNames.js';
import { basenameWithoutExt, type ManifestEntry } from './manifest.js';

// A finished edit is named  <working basename>[Adobe tokens]_edited[suffix].<ext>
// where the working basename is that of the copy Export created.
//
//   IMG_2579_edited.tif            Lightroom-only edit
//   IMG_2579_edited_v2.tif         further version (any suffix without "_edited")
//   IMG_2579-Edit_edited.tif       Photoshop round trip
//   IMG_2579-Edit-2_edited_v2.tif  second Photoshop derivative
//
// "Adobe tokens" are the derivative suffixes Lightroom Classic appends to the
// working file it creates: -Edit, -Edit-N (Edit in Photoshop), -Enhanced,
// -Enhanced-NR / -Enhanced-SR (Enhance), -HDR, -Pano. Matching is on this
// explicit grammar, never on a bare prefix or substring. The one extension: after
// a coded name (IMG_2579__tdg0f1023d0), which identifies its photo by itself, a
// description starting with "-" may stand where the Adobe tokens would:
//
//   IMG_2579__tdg0f1023d0-restoration_edited.tif
//
// The `_edited` marker is the LAST one in the name: whatever follows it is a
// version suffix and cannot itself contain `_edited`. That keeps chained edits
// unambiguous — IMG_4516_edited_ai_edited.tif is an edit of the asset named
// IMG_4516_edited_ai, not a second edit of IMG_4516.

const EDITED_MARKER = '_edited';
const ADOBE_TOKENS = /^(?:-edit(?:-\d+)?|-enhanced(?:-nr|-sr)?|-hdr|-pano)+$/;

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

/**
 * The working basename a returned file was probably made from: its stem up to the
 * export code, or else with any trailing Adobe derivative tokens removed.
 */
export function inferOriginalBasename(filename: string): string | null {
  const stem = extractEditedStem(filename);
  if (stem == null) {
    return null;
  }
  const coded = codedPrefix(stem);
  if (coded) {
    return coded;
  }
  const stripped = stem.replace(TRAILING_ADOBE_TOKENS, '');
  return stripped.length > 0 ? stripped : stem;
}

export type FilenameMatch =
  | { kind: 'ignored' }
  | { kind: 'unmatched' }
  | { kind: 'matched'; entry: ManifestEntry }
  | { kind: 'ambiguous'; candidates: ManifestEntry[] };

/** The name returned edits are matched against; older entries recorded only the original. */
function workingBasename(entry: ManifestEntry): string {
  return entry.exportedFilename ? basenameWithoutExt(entry.exportedFilename) : entry.originalBasename;
}

function entryMatchesStem(entry: ManifestEntry, stemLower: string): boolean {
  const nameLower = workingBasename(entry).toLowerCase();
  if (nameLower.length === 0 || !stemLower.startsWith(nameLower)) {
    return false;
  }
  const remainder = stemLower.slice(nameLower.length);
  if (remainder.length === 0 || ADOBE_TOKENS.test(remainder)) {
    return true;
  }
  return (
    endsWithExportCode(nameLower) &&
    remainder.startsWith('-') &&
    !remainder.includes(EDITED_MARKER) &&
    !remainder.includes('__tdg')
  );
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
