/*
  One-off migration for the AI/Manual edit-method feature.

  1. Sets editMethod = 'manual' on every MediaAsset that is an edited copy
     (sourceAssetId set) and doesn't already have an editMethod. Every edited
     copy imported before this feature existed predates the AI/Manual
     distinction, so per product decision they default to 'manual'.

  2. Migrates the legacy single-valued editedAssetId field (used before an
     original could have more than one edited version) into the new
     editedAssetIds array, then removes the legacy field. Reads it via the
     raw collection since it's no longer part of the MediaAsset type.

  Usage:
    Dry run (prints planned changes, touches nothing):
      pnpm --filter @tedography/api exec tsx src/tools/backfillEditMethod.ts

    Apply:
      pnpm --filter @tedography/api exec tsx src/tools/backfillEditMethod.ts --apply
*/

import mongoose from 'mongoose';
import type { MediaAsset } from '@tedography/domain';
import { connectToMongo } from '../db.js';
import { MediaAssetModel } from '../models/mediaAssetModel.js';

function parseArgs(argv: string[]): { apply: boolean } {
  for (const arg of argv) {
    if (arg === '--apply') return { apply: true };
    if (arg === '--help' || arg === '-h') {
      console.log('Usage: backfillEditMethod.ts [--apply]');
      console.log('  --apply   Write changes. Without this flag, dry-run mode.');
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return { apply: false };
}

async function run(): Promise<void> {
  const { apply } = parseArgs(process.argv.slice(2));

  console.log(`Mode: ${apply ? 'APPLY (changes will be written)' : 'DRY RUN (no changes written)'}`);
  console.log('');

  await connectToMongo();

  try {
    // ── Part 1: default editMethod = 'manual' on existing edited copies ───────

    console.log('── Part 1: MediaAsset.editMethod ──────────────────────────────────────');
    console.log('');

    const editedAssetsMissingMethod = await MediaAssetModel
      .find({ sourceAssetId: { $exists: true, $ne: null }, editMethod: { $exists: false } })
      .lean<MediaAsset[]>();

    console.log(`Edited copies without editMethod: ${editedAssetsMissingMethod.length}`);
    for (const asset of editedAssetsMissingMethod) {
      console.log(`  ${asset.filename}  →  editMethod = manual`);
      if (apply) {
        await MediaAssetModel.updateOne({ id: asset.id }, { $set: { editMethod: 'manual' } });
      }
    }

    console.log('');
    if (apply) {
      console.log(`MediaAsset.editMethod: updated=${editedAssetsMissingMethod.length}`);
    } else {
      console.log(`MediaAsset.editMethod: would-update=${editedAssetsMissingMethod.length}`);
    }
    console.log('');

    // ── Part 2: migrate legacy single editedAssetId into editedAssetIds ───────

    console.log('── Part 2: MediaAsset.editedAssetId → editedAssetIds ──────────────────');
    console.log('');

    const legacyAssets = (await MediaAssetModel.collection
      .find({ editedAssetId: { $exists: true, $ne: null } })
      .toArray()) as unknown as (MediaAsset & { editedAssetId?: string | null })[];

    console.log(`Originals with legacy editedAssetId: ${legacyAssets.length}`);

    let migrated = 0;
    let alreadyPresent = 0;

    for (const asset of legacyAssets) {
      const legacyId = asset.editedAssetId;
      if (!legacyId) continue;

      if ((asset.editedAssetIds ?? []).includes(legacyId)) {
        alreadyPresent++;
        if (apply) {
          await MediaAssetModel.collection.updateOne({ id: asset.id }, { $unset: { editedAssetId: '' } });
        }
        continue;
      }

      console.log(`  ${asset.filename}  →  editedAssetIds += ${legacyId}`);
      if (apply) {
        await MediaAssetModel.collection.updateOne(
          { id: asset.id },
          { $addToSet: { editedAssetIds: legacyId }, $unset: { editedAssetId: '' } }
        );
      }
      migrated++;
    }

    console.log('');
    if (apply) {
      console.log(`editedAssetIds: migrated=${migrated}  already-present=${alreadyPresent}`);
    } else {
      console.log(`editedAssetIds: would-migrate=${migrated}  already-present(would-clean)=${alreadyPresent}`);
    }
    console.log('');

    console.log('─'.repeat(60));
    if (!apply) {
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
