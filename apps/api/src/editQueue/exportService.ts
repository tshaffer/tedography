import fs from 'node:fs/promises';
import path from 'node:path';
import {
  codedFilename,
  exportCodes,
  nameKeyOf,
  recordFromEntry,
  type ExportNameRecord,
  type ExportNameStore,
} from './exportNames.js';
import { isSameJpegPicture } from './jpegImageData.js';
import { basenameWithoutExt, exportedNameOf, type ManifestEntry } from './manifest.js';

// Export copies an original into the export folder ("Active Edits") — and does
// nothing else there. It never overwrites, deletes or renames anything: Lightroom
// may have catalogued the file, written metadata into it, or built a project
// around it. Every outcome is reported per photo.
//
// Each photo has one working filename for good (see exportNames.ts). It is, in
// order: the one already recorded; the library filename, if a verifiable copy
// under that name is already in the export folder; or a new coded name.

export type ExportStatus =
  | 'exported' // new working copy created
  | 'alreadyExported' // an existing file is verifiably this photo's working copy; left untouched
  | 'previouslyExported' // exported before, but no file at the expected location; needs confirmation
  | 'conflict' // a file with that name exists and isn't verifiably this photo's; left untouched
  | 'failed';

export interface ExportItemResult {
  assetId: string;
  // The photo's library filename.
  filename: string;
  // Its working filename in the export folder; null if none was determined.
  exportedFilename: string | null;
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
  names: ExportNameStore;
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

async function statIfExists(target: string): Promise<Awaited<ReturnType<typeof fs.lstat>> | null> {
  return fs.lstat(target).catch((err: NodeJS.ErrnoException) => {
    if (err.code === 'ENOENT') return null;
    throw err;
  });
}

/** Proof from the files alone: identical, or (JPEG only) the same picture with different metadata. */
async function isCopyOfOriginal(input: ExportAssetInput, ctx: ExportContext, candidate: string): Promise<boolean> {
  return (
    (input.contentHash != null && (await ctx.hashFile(candidate)) === input.contentHash) ||
    (await isSameJpegPicture(input.sourcePath, candidate))
  );
}

/** True when the manifest ties this working filename to some other asset. */
function claimedByAnother(ctx: ExportContext, assetId: string, filename: string): boolean {
  const lower = filename.toLowerCase();
  return ctx.manifestEntries.some((e) => e.sourceAssetId !== assetId && exportedNameOf(e).toLowerCase() === lower);
}

async function assignCodedName(input: ExportAssetInput, ctx: ExportContext, createdAt: string): Promise<ExportNameRecord> {
  for (const code of exportCodes(input.assetId)) {
    const candidate = codedFilename(input.filename, code);
    const key = nameKeyOf(candidate);
    const taken = ctx.manifestEntries.some(
      (e) => e.sourceAssetId !== input.assetId && nameKeyOf(exportedNameOf(e)) === key
    );
    if (taken) continue;
    const record = await ctx.names.claim({
      assetId: input.assetId,
      exportedFilename: candidate,
      originalFilename: input.filename,
      exported: false,
      createdAt,
    });
    if (record) return record;
  }
  throw new Error('Could not assign a unique export filename');
}

export async function exportOneAsset(input: ExportAssetInput, ctx: ExportContext): Promise<ExportOutcome> {
  const { assetId, filename } = input;
  let workingName: string | null = null;
  const done = (status: ExportStatus, message: string, manifestEntry: ManifestEntry | null = null): ExportOutcome => ({
    result: { assetId, filename, exportedFilename: workingName, status, message },
    manifestEntry,
  });

  if (filename.length === 0 || filename !== path.basename(filename)) {
    return done('failed', 'Invalid filename');
  }

  const nowIso = (ctx.now?.() ?? new Date()).toISOString();
  const previous = ctx.manifestEntries.find((e) => e.sourceAssetId === assetId) ?? null;
  const buildEntry = (exportedFilename: string, exportedAt: string): ManifestEntry => ({
    sourceAssetId: assetId,
    originalFilename: filename,
    originalBasename: basenameWithoutExt(filename),
    note: input.note,
    exportedFilename,
    exportedAt,
  });
  const alreadyExported = async (name: string): Promise<ExportOutcome> => {
    await ctx.names.markExported(assetId);
    return done(
      'alreadyExported',
      'This photo already has a working copy in the export folder. It was left untouched; no new file was copied.',
      buildEntry(name, previous?.exportedAt ?? nowIso)
    );
  };

  try {
    await fs.mkdir(ctx.exportPath, { recursive: true });

    let record = await ctx.names.find(assetId);
    if (!record && previous) {
      record = await ctx.names.claim(recordFromEntry(previous));
      if (!record) {
        return done('conflict', 'The export filename listed for this photo is recorded for a different photo. Nothing was changed.');
      }
    }

    if (!record) {
      // A copy made before names were recorded keeps its name. A file under that
      // name that belongs to another photo is simply left where it is.
      const plain = path.join(ctx.exportPath, filename);
      const stat = await statIfExists(plain);
      if (stat && !claimedByAnother(ctx, assetId, filename)) {
        if (!stat.isFile() || !(await isCopyOfOriginal(input, ctx, plain))) {
          workingName = filename;
          return done(
            'conflict',
            'A file with this name already exists in the export folder and could not be confirmed as this photo’s working copy. Nothing was changed; move or rename it, then export again.'
          );
        }
        record = await ctx.names.claim({
          assetId,
          exportedFilename: filename,
          originalFilename: filename,
          exported: true,
          createdAt: nowIso,
        });
        if (record) {
          workingName = record.exportedFilename;
          return await alreadyExported(record.exportedFilename);
        }
      }
      record ??= await assignCodedName(input, ctx, nowIso);
    }

    const name = record.exportedFilename;
    workingName = name;
    const dest = path.join(ctx.exportPath, name);
    const exportedBefore = record.exported || previous != null;

    // Exported before but nothing at the expected path: the working copy may have
    // been moved into a project folder. Copying again would give Lightroom a
    // second copy to register, so ask first.
    if (exportedBefore && !ctx.force && !(await statIfExists(dest))) {
      return done(
        'previouslyExported',
        `Exported before as ${name}, but no file with that name is in the export folder now. An editing project may already exist elsewhere (for example in a project subfolder). Export anyway to create a new working copy.`
      );
    }

    // COPYFILE_EXCL makes the existence check and the copy one atomic step.
    try {
      await fs.copyFile(input.sourcePath, dest, fs.constants.COPYFILE_EXCL);
      // Recorded straight away, so the link survives even if saving the manifest fails.
      await ctx.names.markExported(assetId);
      return done('exported', 'Copied to the export folder', buildEntry(name, nowIso));
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

    // A name the manifest ties to another asset is never taken over, however
    // alike the two files are.
    if (claimedByAnother(ctx, assetId, name)) {
      return done(
        'conflict',
        'A different photo with the same filename was already exported here. Nothing was changed; rename or move one of them manually.'
      );
    }

    // Proof, in order of cost: Tedography's own record of the export (database or
    // manifest), then the files themselves.
    const listedHere = previous != null && exportedNameOf(previous).toLowerCase() === name.toLowerCase();
    if (record.exported || listedHere || (await isCopyOfOriginal(input, ctx, dest))) {
      return await alreadyExported(name);
    }

    return done(
      'conflict',
      'A file with this name already exists in the export folder and could not be confirmed as this photo’s working copy. Nothing was changed.'
    );
  } catch (err) {
    return done('failed', err instanceof Error ? err.message : String(err));
  }
}
