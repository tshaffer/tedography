/*
  One-time migration: rename the "prompt" field to "note" in the
  editQueue and editHistory MongoDB collections.

  Safe to run multiple times — skips documents that already have "note".

  Usage:
    Dry run:
      pnpm --filter @tedography/api exec tsx src/tools/migratePromptToNote.ts

    Apply:
      pnpm --filter @tedography/api exec tsx src/tools/migratePromptToNote.ts --apply
*/

import mongoose from 'mongoose';
import { connectToMongo } from '../db.js';

function parseArgs(argv: string[]): { apply: boolean } {
  for (const arg of argv) {
    if (arg === '--apply') return { apply: true };
    if (arg === '--help' || arg === '-h') {
      console.log('Usage: migratePromptToNote.ts [--apply]');
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return { apply: false };
}

async function migrateCollection(
  db: mongoose.mongo.Db,
  collectionName: string,
  apply: boolean
): Promise<void> {
  const collection = db.collection(collectionName);

  // Count docs that still have a "prompt" field.
  const count = await collection.countDocuments({ prompt: { $exists: true } });
  console.log(`  "${collectionName}": ${count} document(s) with "prompt" field`);

  if (count === 0) {
    console.log(`  → Nothing to do.`);
    return;
  }

  if (apply) {
    const result = await collection.updateMany(
      { prompt: { $exists: true } },
      [{ $set: { note: '$prompt' } }, { $unset: 'prompt' }]
    );
    console.log(`  → Renamed "prompt" → "note" on ${result.modifiedCount} document(s).`);
  } else {
    console.log(`  → Would rename "prompt" → "note" on ${count} document(s).`);
  }
}

async function run(): Promise<void> {
  const { apply } = parseArgs(process.argv.slice(2));
  console.log(`Mode: ${apply ? 'APPLY (changes will be written)' : 'DRY RUN (no changes written)'}`);
  console.log('');

  await connectToMongo();

  try {
    const db = mongoose.connection.db;
    if (!db) throw new Error('No database connection');

    await migrateCollection(db, 'editQueue', apply);
    console.log('');
    await migrateCollection(db, 'editHistory', apply);
    console.log('');

    console.log('─'.repeat(60));
    if (!apply) {
      console.log('Run with --apply to apply these changes.');
    } else {
      console.log('Done.');
    }
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
