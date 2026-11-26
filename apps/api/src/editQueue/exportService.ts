import fs from 'node:fs/promises';
import path from 'node:path';
import { isSameJpegPicture } from './jpegImageData.js';
import { basenameWithoutExt, type ManifestEntry } from './manifest.js';

// Export copies an original into the export folder ("Active Edits") — and does
// nothing else there. It never overwrites, deletes or renames anything: Lightroom
// may have catalogued the file, written metadata into it, or built a project
// around it. Every outcome is reported per photo.

export type ExportStatus =
  | 'exported' // new working copy created
  | 'alreadyExported' // an existing file is verifiably this photo's working copy; left untouched
  | 'previouslyExported' // exported before, but no file at the expected location; needs confirmation
  | 'conflict' // a file with that name exists and isn't verifiably this photo's; left untouched
  | 'failed';

export interface ExportItemResult {
  assetId: string;
  filename: string;
  status: ExportStatus;
  message: string;
}

export interface ExportAssetInput {
  assetId: string;
  filename: string;
  sourcePath: string;
  // SHA-256 of the permanent original, used as proof that an existing file is an
  // unmodified copy of this photo.
  contentHash: string | null;
  note: string;
}

export interface ExportContext {
  exportPath: string;
  manifestEntries: ManifestEntry[];
  // User confirmed re-exporting photos whose earlier working copy can't be found.
  force: boolean;
  hashFile: (absolutePath: string) => Promise<string>;
  now?: () => Date;
}

export interface ExportOutcome {
  result: ExportItemResult;
  // Present only when a source-to-working-copy association is reliably established.
  manifestEntry: ManifestEntry | null;
}

function exportedNameOf(entry: ManifestEntry): string {
  return (entry.exportedFilename ?? entry.originalFilename).toLowerCase();
}

export async function exportOneAsset(input: ExportAssetInput, ctx: ExportContext): Promise<ExportOutcome> {
  const { assetId, filename } = input;
  const done = (status: ExportStatus, message: string, manifestEntry: ManifestEntry | null = null): ExportOutcome => ({
    result: { assetId, filename, status, message },
    manifestEntry,
  });

  if (filename.length === 0 || filename !== path.basename(filename)) {
    return done('failed', 'Invalid filename');
  }

  const nowIso = (ctx.now?.() ?? new Date()).toISOString();
  const previous = ctx.manifestEntries.find((e) => e.sourceAssetId === assetId) ?? null;
  const buildEntry = (exportedAt: string): ManifestEntry => ({
    sourceAssetId: assetId,
    originalFilename: filename,
    originalBasename: basenameWithoutExt(filename),
    note: input.note,
    exportedFilename: filename,
    exportedAt,
  });

  const dest = path.join(ctx.exportPath, filename);

  try {
    await fs.mkdir(ctx.exportPath, { recursive: true });

    // Exported before but nothing at the expected path: the working copy may have
    // been moved into a project folder. Copying again would give Lightroom a
    // second copy to register, so ask first.
    if (previous && !ctx.force) {
      const exists = await fs.lstat(dest).then(
        () => true,
        (err: NodeJS.ErrnoException) => {
          if (err.code === 'ENOENT') return false;
          throw err;
        }
      );
      if (!exists) {
        return done(
          'previouslyExported',
          'Exported before, but no file with this name is in the export folder now. An editing project may already exist elsewhere (for example in a project subfolder). Export anyway to create a new working copy.'
        );
      }
    }

    // COPYFILE_EXCL makes the existence check and the copy one atomic step.
    try {
      await fs.copyFile(input.sourcePath, dest, fs.constants.COPYFILE_EXCL);
      return done('exported', 'Copied to the export folder', buildEntry(nowIso));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw err;
      }
    }

    // Something is already there. Decide whether it is this photo's working copy.
    const stat = await fs.lstat(dest);
    if (!stat.isFile()) {
      return done('conflict', 'A file or folder with this name exists in the export folder and is not a regular file. Nothing was changed.');
    }

    const lowerName = filename.toLowerCase();
    const claimants = ctx.manifestEntries.filter((e) => exportedNameOf(e) === lowerName);

    // A name the manifest ties to another asset is never taken over, however
    // alike the two files are.
    if (claimants.some((e) => e.sourceAssetId !== assetId)) {
      return done(
        'conflict',
        'A different photo with the same filename was already exported here. Nothing was changed; rename or move one of them manually.'
      );
    }

    // Proof, in order of cost: the manifest, an identical file, or (JPEG only) the
    // same picture with different metadata.
    const verified =
      claimants.length > 0 ||
      (input.contentHash != null && (await ctx.hashFile(dest)) === input.contentHash) ||
      (await isSameJpegPicture(input.sourcePath, dest));

    if (verified) {
      return done(
        'alreadyExported',
        'This photo already has a working copy in the export folder. It was left untouched; no new file was copied.',
        buildEntry(previous?.exportedAt ?? nowIso)
      );
    }

    return done(
      'conflict',
      'A file with this name already exists in the export folder and could not be confirmed as this photo’s working copy. Nothing was changed.'
    );
  } catch (err) {
    return done('failed', err instanceof Error ? err.message : String(err));
  }
}
