/*
  Renames the storage root ID in all mediaAsset documents from the old value
  to the new value, for both originalStorageRootId and displayStorageRootId.

  Run this after moving the media directory and updating TEDOGRAPHY_STORAGE_ROOTS
  in .env to use the new ID.

Usage:
  Dry run (no changes written):
    pnpm --filter @tedography/api exec tsx src/tools/migrateStorageRootId.ts

  Apply changes:
    pnpm --filter @tedography/api exec tsx src/tools/migrateStorageRootId.ts --apply
*/

import mongoose from 'mongoose';
import { connectToMongo } from '../db.js';
import { MediaAssetModel } from '../models/mediaAssetModel.js';

const OLD_ID = 'shafferographymedia';
const NEW_ID = 'tedographymedia';

function parseArgs(argv: string[]): { apply: boolean } {
  for (const arg of argv) {
    if (arg === '--apply') return { apply: true };
    if (arg === '--help' || arg === '-h') {
      console.log('Usage: migrateStorageRootId.ts [--apply]');
      console.log('  --apply   Persist changes. Without this flag, runs in dry-run mode.');
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return { apply: false };
}

async function run(): Promise<void> {
  const { apply } = parseArgs(process.argv.slice(2));

  console.log(`Mode: ${apply ? 'APPLY (changes will be written)' : 'dry run (no changes written)'}`);
  console.log(`Renaming storage root ID: "${OLD_ID}" → "${NEW_ID}"`);
  console.log('');

  await connectToMongo();

  try {
    const originalCount = await MediaAssetModel.countDocuments({ originalStorageRootId: OLD_ID });
    const displayCount = await MediaAssetModel.countDocuments({ displayStorageRootId: OLD_ID });

    console.log(`originalStorageRootId="${OLD_ID}": ${originalCount} documents`);
    console.log(`displayStorageRootId="${OLD_ID}":  ${displayCount} documents`);
    console.log('');

    if (originalCount === 0 && displayCount === 0) {
      console.log(`No documents found with storage root ID "${OLD_ID}". Nothing to do.`);
      return;
    }

    if (!apply) {
      console.log(`Would update ${originalCount} originalStorageRootId and ${displayCount} displayStorageRootId documents.`);
      console.log('');
      console.log('Run with --apply to commit these changes.');
      return;
    }

    if (originalCount > 0) {
      const result = await MediaAssetModel.updateMany(
        { originalStorageRootId: OLD_ID },
        { $set: { originalStorageRootId: NEW_ID } }
      );
      console.log(`Updated originalStorageRootId: ${result.modifiedCount} documents`);
    }

    if (displayCount > 0) {
      const result = await MediaAssetModel.updateMany(
        { displayStorageRootId: OLD_ID },
        { $set: { displayStorageRootId: NEW_ID } }
      );
      console.log(`Updated displayStorageRootId:  ${result.modifiedCount} documents`);
    }

    console.log('');
    console.log('Migration complete.');
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
