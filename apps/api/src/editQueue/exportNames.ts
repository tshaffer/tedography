import { createHash } from 'node:crypto';
import path from 'node:path';
import { basenameWithoutExt, exportedNameOf, type ManifestEntry } from './manifest.js';

// New working copies are named  <root>__tdg<code>.<ext>  where <code> comes from
// the source asset's id, so photos that share a library filename never share a
// working filename. A name is assigned once, recorded permanently, and reused.
// Names recorded before codes existed stay exactly as they were.

const CODE_MARKER = '__tdg';
const FIRST_CODE = /__tdg[0-9a-f]{8,}/i;
const ENDS_WITH_CODE = /__tdg[0-9a-f]{8,}$/i;
const CODE_LENGTHS = [8, 12, 16, 20, 24, 28, 32];

export const TRAILING_ADOBE_TOKENS = /(?:-edit(?:-\d+)?|-enhanced(?:-nr|-sr)?|-hdr|-pano)+$/i;

export interface ExportNameRecord {
  assetId: string;
  exportedFilename: string;
  originalFilename: string;
  // True once a working copy under this name has been created or verified. A name
  // can be reserved without one if the copy then failed.
  exported: boolean;
  createdAt: string;
}

export interface ExportNameStore {
  find(assetId: string): Promise<ExportNameRecord | null>;
  /**
   * Records an asset's name. Returns the asset's record — the existing one if it
   * already has a name — or null if the name belongs to another asset.
   */
  claim(record: ExportNameRecord): Promise<ExportNameRecord | null>;
  markExported(assetId: string): Promise<void>;
}

/** What two filenames must differ in for returned edits to tell them apart. */
export function nameKeyOf(filename: string): string {
  return basenameWithoutExt(filename).toLowerCase();
}

export function endsWithExportCode(basename: string): boolean {
  return ENDS_WITH_CODE.test(basename);
}

/** The part of a name up to and including its first export code, if it has one. */
export function codedPrefix(name: string): string | null {
  const match = FIRST_CODE.exec(name);
  return match && match.index > 0 ? name.slice(0, match.index + match[0].length) : null;
}

/**
 * The readable part of a new export name. For a photo that is itself an edit, an
 * ancestor's code, the `_edited…` text and Adobe suffixes are dropped, so names
 * stay the same length however many generations of editing there are.
 */
export function exportRootName(filename: string): string {
  const base = basenameWithoutExt(filename);
  let root = base;
  const code = root.search(FIRST_CODE);
  if (code > 0) {
    root = root.slice(0, code);
  }
  const edited = root.toLowerCase().indexOf('_edited');
  if (edited > 0) {
    root = root.slice(0, edited);
  }
  if (root === base) {
    return base;
  }
  return root.replace(TRAILING_ADOBE_TOKENS, '') || root;
}

/** Candidate codes for an asset, shortest first; longer ones resolve collisions. */
export function exportCodes(assetId: string): string[] {
  const compact = assetId.replace(/-/g, '').toLowerCase();
  const hex = /^[0-9a-f]{32}$/.test(compact)
    ? compact
    : createHash('sha256').update(assetId).digest('hex').slice(0, 32);
  return CODE_LENGTHS.map((length) => hex.slice(0, length));
}

export function codedFilename(filename: string, code: string): string {
  return `${exportRootName(filename)}${CODE_MARKER}${code}${path.extname(filename)}`;
}

export function recordFromEntry(entry: ManifestEntry, now = new Date()): ExportNameRecord {
  return {
    assetId: entry.sourceAssetId,
    exportedFilename: exportedNameOf(entry),
    originalFilename: entry.originalFilename,
    exported: true,
    createdAt: entry.exportedAt ?? now.toISOString(),
  };
}

/**
 * Manifest entries for recorded working copies the manifest doesn't list — all of
 * them if manifest.json has been lost. Entries already present are left alone.
 */
export function entriesMissingFromManifest(
  records: ExportNameRecord[],
  entries: ManifestEntry[],
  noteFor: (assetId: string) => string = () => ''
): ManifestEntry[] {
  const present = new Set(entries.map((e) => e.sourceAssetId));
  return records
    .filter((r) => r.exported && !present.has(r.assetId))
    .map((r) => ({
      sourceAssetId: r.assetId,
      originalFilename: r.originalFilename,
      originalBasename: basenameWithoutExt(r.originalFilename),
      note: noteFor(r.assetId),
      exportedFilename: r.exportedFilename,
    }));
}
