import fs from 'node:fs/promises';
import path from 'node:path';

export const MANIFEST_FILENAME = 'manifest.json';
export const NOTES_FILENAME = 'notes.txt';

export interface ManifestEntry {
  sourceAssetId: string;
  originalFilename: string;
  originalBasename: string;
  note: string;
  // Added later; absent in manifests written by older versions. `exportedFilename`
  // is the name of the working copy created in the export folder (always the
  // original filename today); it is how a later export recognizes its own file.
  exportedFilename?: string;
  exportedAt?: string;
}

export interface Manifest {
  exportedAt: string;
  entries: ManifestEntry[];
}

export function basenameWithoutExt(filename: string): string {
  const ext = path.extname(filename);
  return ext ? filename.slice(0, -ext.length) : filename;
}

export async function readManifest(editPath: string): Promise<Manifest | null> {
  try {
    const raw = await fs.readFile(path.join(editPath, MANIFEST_FILENAME), 'utf-8');
    const parsed = JSON.parse(raw) as Manifest;
    if (!parsed || !Array.isArray(parsed.entries)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Atomic replace: write a temp file next to the manifest, then rename over it. */
async function writeManifestAtomic(editPath: string, manifest: Manifest): Promise<void> {
  const target = path.join(editPath, MANIFEST_FILENAME);
  const temp = path.join(editPath, `.${MANIFEST_FILENAME}.${process.pid}.tmp`);
  await fs.writeFile(temp, JSON.stringify(manifest, null, 2), 'utf-8');
  await fs.rename(temp, target);
}

// Serializes manifest read-modify-write cycles so overlapping exports can't
// lose each other's entries.
let manifestLock: Promise<unknown> = Promise.resolve();

/**
 * Merges `newEntries` into the manifest (creating it if missing). Existing
 * entries for other assets are always kept; an entry for the same asset is
 * replaced. Entries are never pruned here.
 */
export function mergeIntoManifest(editPath: string, newEntries: ManifestEntry[]): Promise<Manifest> {
  const run = async (): Promise<Manifest> => {
    await fs.mkdir(editPath, { recursive: true });
    // A missing manifest starts fresh, but an unreadable one must not be
    // silently replaced — that would discard every source-to-edit association.
    const exists = await fs
      .access(path.join(editPath, MANIFEST_FILENAME))
      .then(() => true)
      .catch(() => false);
    const existing = await readManifest(editPath);
    if (exists && !existing) {
      throw new Error(`${MANIFEST_FILENAME} exists but could not be read; refusing to overwrite it.`);
    }
    const merged = new Map((existing?.entries ?? []).map((e) => [e.sourceAssetId, e]));
    for (const entry of newEntries) {
      merged.set(entry.sourceAssetId, entry);
    }
    const manifest: Manifest = {
      exportedAt: new Date().toISOString(),
      entries: Array.from(merged.values()),
    };
    await writeManifestAtomic(editPath, manifest);
    return manifest;
  };
  const result = manifestLock.then(run, run);
  manifestLock = result.catch(() => undefined);
  return result;
}
