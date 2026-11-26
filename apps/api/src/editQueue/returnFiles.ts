import fs from 'node:fs/promises';
import path from 'node:path';
import { extractEditedStem, inferOriginalBasename, isIgnoredFolderFile, matchEditedFilename } from './editedFilenameMatch.js';
import { MANIFEST_FILENAME, NOTES_FILENAME, type ManifestEntry } from './manifest.js';

// Everything that reads or deletes inside the return folder lives here. All of it
// is non-recursive and limited to regular files directly inside the folder:
// directories and symbolic links are never followed, listed as deletable, or removed.

export interface ReturnFile {
  filename: string;
  size: number;
  modifiedAt: string;
  // True when the name looks like edit output (contains an `_edited` marker) —
  // the only files "Clear Returned Files" will remove.
  isEditOutput: boolean;
}

export interface ReturnScanResult {
  matched: Array<{ filename: string; entry: ManifestEntry }>;
  ambiguous: Array<{ filename: string; candidates: ManifestEntry[] }>;
  unmatched: Array<{ filename: string; inferredBasename: string | null }>;
}

function isBookkeepingFile(filename: string): boolean {
  return filename === MANIFEST_FILENAME || filename === NOTES_FILENAME;
}

/** Regular, non-hidden files directly inside the folder (not manifest/notes). */
export async function listReturnFiles(returnPath: string): Promise<ReturnFile[]> {
  let names: string[];
  try {
    names = await fs.readdir(returnPath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw err;
  }

  const files: ReturnFile[] = [];
  for (const filename of names) {
    if (isIgnoredFolderFile(filename) || isBookkeepingFile(filename)) {
      continue;
    }
    const stat = await fs.lstat(path.join(returnPath, filename));
    if (!stat.isFile()) {
      continue;
    }
    files.push({
      filename,
      size: stat.size,
      modifiedAt: stat.mtime.toISOString(),
      isEditOutput: extractEditedStem(filename) != null,
    });
  }
  files.sort((a, b) => a.filename.localeCompare(b.filename, undefined, { numeric: true }));
  return files;
}

/** Classifies each edit-output file in the return folder against the manifest. */
export async function scanReturnFolder(returnPath: string, entries: ManifestEntry[]): Promise<ReturnScanResult> {
  const result: ReturnScanResult = { matched: [], ambiguous: [], unmatched: [] };
  for (const file of await listReturnFiles(returnPath)) {
    if (!file.isEditOutput) {
      continue;
    }
    const match = matchEditedFilename(file.filename, entries);
    if (match.kind === 'matched') {
      result.matched.push({ filename: file.filename, entry: match.entry });
    } else if (match.kind === 'ambiguous') {
      result.ambiguous.push({ filename: file.filename, candidates: match.candidates });
    } else if (match.kind === 'unmatched') {
      result.unmatched.push({ filename: file.filename, inferredBasename: inferOriginalBasename(file.filename) });
    }
  }
  return result;
}

/** The files "Clear Returned Files" would delete: edit output only, never anything else. */
export async function listClearableReturnFiles(returnPath: string): Promise<ReturnFile[]> {
  return (await listReturnFiles(returnPath)).filter((file) => file.isEditOutput);
}

export class UnsafeDeleteError extends Error {}

/** Deletes one regular file that sits directly in the return folder. */
export async function deleteReturnFile(returnPath: string, filename: string): Promise<void> {
  if (
    filename.length === 0 ||
    filename !== path.basename(filename) ||
    filename.includes('/') ||
    filename.includes('\\') ||
    filename === '.' ||
    filename === '..'
  ) {
    throw new UnsafeDeleteError('Invalid filename');
  }
  if (isBookkeepingFile(filename)) {
    throw new UnsafeDeleteError(`${filename} cannot be deleted here`);
  }
  const target = path.join(returnPath, filename);
  const stat = await fs.lstat(target);
  if (!stat.isFile()) {
    throw new UnsafeDeleteError('Only regular files can be deleted');
  }
  await fs.unlink(target);
}

/**
 * Deletes the clearable files (optionally limited to `onlyFilenames`, so the
 * set the user confirmed is the set removed). Returns the deleted filenames.
 */
export async function clearReturnedFiles(returnPath: string, onlyFilenames?: string[]): Promise<string[]> {
  const allow = onlyFilenames ? new Set(onlyFilenames) : null;
  const deleted: string[] = [];
  for (const file of await listClearableReturnFiles(returnPath)) {
    if (allow && !allow.has(file.filename)) {
      continue;
    }
    await deleteReturnFile(returnPath, file.filename);
    deleted.push(file.filename);
  }
  return deleted;
}
