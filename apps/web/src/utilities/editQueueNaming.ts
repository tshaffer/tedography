function basenameWithoutExt(filename: string): string {
  const dotIndex = filename.lastIndexOf('.');
  return dotIndex > 0 ? filename.slice(0, dotIndex) : filename;
}

/**
 * When the asset being queued is itself an already-edited copy (its own
 * filename contains "_edited"), Export writes its manifest entry keyed off
 * *that* filename — so the next external-tool export must start with
 * `<thisBasename>_edited` to be matched back to it on import (see
 * findManifestMatchForFilename in editQueueRoutes.ts). Returns null for a
 * plain original, where no such hint is needed.
 */
export function nextEditExportHint(filename: string): string | null {
  const base = basenameWithoutExt(filename);
  return base.toLowerCase().includes('_edited') ? `${base}_edited` : null;
}
