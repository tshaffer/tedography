/*
  Migrates edit-queue imported assets: moves _edited files from the edit folder
  to the same directory as their source (original) file, and updates the database.

  Background:
    The original import strategy registered edited files in-place in
    TEDOGRAPHY_EDIT_PATH, using the virtual storage root id "edit-queue".
    The current strategy moves them to the source file's folder on import.
    This script brings legacy assets in line with the new strategy.

  Identification:
    Affected assets have originalStorageRootId === "edit-queue".
    Source asset lookup: uses sourceAssetId when present, otherwise derives
    the source basename by stripping "_edited" from the edited filename and
    searches for a non-edit-queue asset whose filename starts with that basename.

  What it does per asset:
    1. Resolves the source asset and its storage root.
    2. Computes the destination: same directory as the source file.
    3. Moves the edited file (cross-volume safe: falls back to copy+delete).
    4. Updates originalStorageRootId, originalArchivePath, and (for archive-root
       display assets, i.e. non-HEIC) displayStorageRootId / displayArchivePath.

  Usage:
    Dry run (prints planned changes, touches nothing):
      pnpm --filter @tedography/api exec tsx src/tools/migrateEditedFilesToSourceFolder.ts

    Apply:
      pnpm --filter @tedography/api exec tsx src/tools/migrateEditedFilesToSourceFolder.ts --apply
*/

import nodeFs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import { connectToMongo } from '../db.js';
import { config } from '../config.js';
import { getStorageRoots, getStorageRootById } from '../import/storageRoots.js';
import { MediaAssetModel } from '../models/mediaAssetModel.js';
import { findById } from '../repositories/assetRepository.js';
import type { MediaAsset } from '@tedography/domain';

const EDIT_QUEUE_ROOT_ID = 'edit-queue';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseArgs(argv: string[]): { apply: boolean } {
  for (const arg of argv) {
    if (arg === '--apply') return { apply: true };
    if (arg === '--help' || arg === '-h') {
      console.log('Usage: migrateEditedFilesToSourceFolder.ts [--apply]');
      console.log('  --apply   Write changes. Without this flag, dry-run mode.');
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return { apply: false };
}

/** Move a file, falling back to copy+delete if src and dest are on different volumes. */
async function moveFile(src: string, dest: string): Promise<void> {
  try {
    await fsp.rename(src, dest);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'EXDEV') {
      await fsp.copyFile(src, dest);
      await fsp.unlink(src);
    } else {
      throw err;
    }
  }
}

function basenameWithoutExt(filename: string): string {
  const ext = path.extname(filename);
  return ext ? filename.slice(0, -ext.length) : filename;
}

/**
 * Given an edited filename like "IMG_2050_edited.png", returns the source
 * basename "IMG_2050" (the part before "_edited").
 */
function deriveSourceBasename(editedFilename: string): string | null {
  const base = basenameWithoutExt(editedFilename).toLowerCase();
  if (!base.endsWith('_edited')) return null;
  return base.slice(0, -'_edited'.length);
}

/**
 * Find the source asset for an edited file.
 * Tries sourceAssetId first; if absent, searches by filename prefix.
 */
async function resolveSourceAsset(
  editedAsset: MediaAsset,
  editQueueRootAbsPath: string,
): Promise<MediaAsset | null> {
  // Fast path: sourceAssetId was recorded at import time.
  if (editedAsset.sourceAssetId) {
    return findById(editedAsset.sourceAssetId);
  }

  // Slow path: derive source basename from the edited filename.
  const sourceBasename = deriveSourceBasename(editedAsset.filename);
  if (!sourceBasename) return null;

  // Search for assets whose filename starts with the source basename (case-insensitive)
  // and are NOT in the edit-queue root.
  const regex = new RegExp(`^${sourceBasename}\\.[^.]+$`, 'i');
  const candidates = await MediaAssetModel
    .find({
      filename: regex,
      originalStorageRootId: { $ne: EDIT_QUEUE_ROOT_ID },
    })
    .lean<MediaAsset[]>();

  if (candidates.length === 1) return candidates[0] ?? null;

  if (candidates.length > 1) {
    // Prefer assets NOT in the edit folder path as a tiebreak.
    const storageRoots = getStorageRoots();
    const notInEdit = candidates.filter((c) => {
      const root = storageRoots.find((r) => r.id === c.originalStorageRootId);
      if (!root) return true;
      const abs = path.join(root.absolutePath, c.originalArchivePath);
      return !abs.startsWith(editQueueRootAbsPath + path.sep) && abs !== editQueueRootAbsPath;
    });
    if (notInEdit.length === 1) return notInEdit[0] ?? null;

    // Tiebreak: prefer HEIC (the original camera format).
    const pool = notInEdit.length > 0 ? notInEdit : candidates;
    const heicCandidates = pool.filter((c) => path.extname(c.filename).toLowerCase() === '.heic');
    if (heicCandidates.length === 1) return heicCandidates[0] ?? null;

    console.warn(
      `  ⚠ Multiple source candidates for "${editedAsset.filename}": ` +
      candidates.map((c) => c.filename).join(', ') +
      ' — skipping'
    );
    return null;
  }

  return null;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function run(): Promise<void> {
  const { apply } = parseArgs(process.argv.slice(2));

  console.log(`Mode: ${apply ? 'APPLY (changes will be written)' : 'DRY RUN (no changes written)'}`);
  console.log('');

  const editPath = config.editPath;
  if (!editPath) {
    console.error('TEDOGRAPHY_EDIT_PATH is not set in .env — nothing to do.');
    process.exit(1);
  }
  console.log(`Edit path: ${editPath}`);
  console.log('');

  await connectToMongo();

  try {
    // All assets registered against the edit-queue virtual storage root.
    const affected = await MediaAssetModel
      .find({ originalStorageRootId: EDIT_QUEUE_ROOT_ID })
      .lean<MediaAsset[]>();

    console.log(`Assets with originalStorageRootId="${EDIT_QUEUE_ROOT_ID}": ${affected.length}`);
    console.log('');

    if (affected.length === 0) {
      console.log('Nothing to migrate.');
      return;
    }

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const asset of affected) {
      // Current file path: editPath / originalArchivePath
      const currentAbsPath = path.join(editPath, asset.originalArchivePath);

      console.log(`• ${asset.filename}`);
      console.log(`  current: ${currentAbsPath}`);

      // ── Resolve source asset ───────────────────────────────────────────────

      const sourceAsset = await resolveSourceAsset(asset, editPath);

      if (!sourceAsset) {
        console.error(`  ✗ Could not identify source asset — skipping`);
        skippedCount++;
        console.log('');
        continue;
      }

      const sourceRoot = getStorageRootById(sourceAsset.originalStorageRootId);
      if (!sourceRoot) {
        console.error(`  ✗ Storage root "${sourceAsset.originalStorageRootId}" not found — skipping`);
        skippedCount++;
        console.log('');
        continue;
      }

      // ── Compute destination ────────────────────────────────────────────────

      const sourceDir = path.dirname(
        path.join(sourceRoot.absolutePath, sourceAsset.originalArchivePath)
      );
      const destAbsPath = path.join(sourceDir, asset.filename);
      const newRelativePath = path.relative(sourceRoot.absolutePath, destAbsPath);

      console.log(`  source:  ${path.join(sourceRoot.absolutePath, sourceAsset.originalArchivePath)}`);
      console.log(`  dest:    ${destAbsPath}`);

      if (!apply) {
        console.log(`  [dry run]`);
        console.log('');
        migratedCount++;
        continue;
      }

      // ── Move file ──────────────────────────────────────────────────────────

      const fileExists = nodeFs.existsSync(currentAbsPath);
      const destExists = nodeFs.existsSync(destAbsPath);

      if (!fileExists) {
        console.warn(`  ⚠ File not found at current location — updating DB only`);
      } else if (destExists) {
        console.error(`  ✗ Destination already exists — skipping`);
        skippedCount++;
        console.log('');
        continue;
      } else {
        try {
          await moveFile(currentAbsPath, destAbsPath);
          console.log(`  ✓ File moved`);
        } catch (err) {
          console.error(`  ✗ Move failed: ${err instanceof Error ? err.message : String(err)}`);
          errorCount++;
          console.log('');
          continue;
        }
      }

      // ── Update DB ──────────────────────────────────────────────────────────

      const dbUpdate: Record<string, string | null> = {
        originalStorageRootId: sourceRoot.id,
        originalArchivePath: newRelativePath,
      };

      // For non-HEIC files the display IS the archive file — update those refs too.
      if (asset.displayStorageType === 'archive-root') {
        dbUpdate.displayStorageRootId = sourceRoot.id;
        dbUpdate.displayArchivePath = newRelativePath;
      }

      await MediaAssetModel.updateOne({ id: asset.id }, { $set: dbUpdate });
      console.log(`  ✓ DB updated  (root: ${sourceRoot.id}  path: ${newRelativePath})`);
      console.log('');
      migratedCount++;
    }

    // ── Summary ───────────────────────────────────────────────────────────────

    console.log('─'.repeat(60));
    if (apply) {
      console.log(`Migrated: ${migratedCount}   Skipped: ${skippedCount}   Errors: ${errorCount}`);
    } else {
      console.log(`Would migrate: ${migratedCount}   Would skip: ${skippedCount}`);
      console.log('');
      console.log('Run with --apply to apply these changes.');
    }
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
