/*
  Backfills editedAssetId on MediaAsset and EditQueueEntry documents that
  were created before those fields were added.

  Strategy:
    Primary:   MediaAsset.sourceAssetId (set on the edited asset at import time)
    Fallback:  editHistory collection (has sourceAssetId → editedAssetId for every
               successful import; used for legacy assets whose sourceAssetId was not
               persisted because the Mongoose schema predated that field)

  What it does:
    1. MediaAsset backfill:
       For every edited asset (sourceAssetId set), writes editedAssetId onto the
       source asset — if not already set.
       Then consults editHistory for any succeeded entries whose source asset still
       lacks editedAssetId, and fills those in too.

    2. EditQueueEntry backfill:
       For every queue entry where editedAssetId is null, finds the corresponding
       edited MediaAsset (via sourceAssetId or editHistory) and writes the id.

  Usage:
    Dry run (prints planned changes, touches nothing):
      pnpm --filter @tedography/api exec tsx src/tools/backfillEditedAssetIds.ts

    Apply:
      pnpm --filter @tedography/api exec tsx src/tools/backfillEditedAssetIds.ts --apply
*/

import mongoose from 'mongoose';
import { connectToMongo } from '../db.js';
import { MediaAssetModel } from '../models/mediaAssetModel.js';
import { EditQueueEntryModel } from '../models/editQueueEntryModel.js';
import { EditHistoryModel } from '../models/editHistoryModel.js';
import type { MediaAsset, EditQueueEntry, EditHistoryEntry } from '@tedography/domain';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseArgs(argv: string[]): { apply: boolean } {
  for (const arg of argv) {
    if (arg === '--apply') return { apply: true };
    if (arg === '--help' || arg === '-h') {
      console.log('Usage: backfillEditedAssetIds.ts [--apply]');
      console.log('  --apply   Write changes. Without this flag, dry-run mode.');
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return { apply: false };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function run(): Promise<void> {
  const { apply } = parseArgs(process.argv.slice(2));

  console.log(`Mode: ${apply ? 'APPLY (changes will be written)' : 'DRY RUN (no changes written)'}`);
  console.log('');

  await connectToMongo();

  try {
    // Load editHistory once — used by all three parts.
    const succeededHistory = await EditHistoryModel
      .find({ status: 'succeeded', editedAssetId: { $exists: true, $ne: null } })
      .lean<EditHistoryEntry[]>();

    // ── Part 0: MediaAsset.sourceAssetId on edited assets ─────────────────────

    console.log('── Part 0: MediaAsset.sourceAssetId on edited assets ─────────────────');
    console.log('');

    let sourceIdUpdated = 0;
    let sourceIdAlreadySet = 0;
    let sourceIdConflict = 0;
    let sourceIdMissing = 0;

    for (const histEntry of succeededHistory) {
      const editedAsset = await MediaAssetModel
        .findOne({ id: histEntry.editedAssetId! })
        .lean<MediaAsset>();

      if (!editedAsset) {
        console.warn(`  ⚠ Edited asset ${histEntry.editedAssetId} not found — skipping`);
        sourceIdMissing++;
        continue;
      }

      if (editedAsset.sourceAssetId) {
        if (editedAsset.sourceAssetId === histEntry.sourceAssetId) {
          sourceIdAlreadySet++;
          continue;
        }
        console.warn(
          `  ⚠ "${editedAsset.filename}" already has sourceAssetId="${editedAsset.sourceAssetId}" ` +
          `(history has sourceAssetId="${histEntry.sourceAssetId}") — skipping`
        );
        sourceIdConflict++;
        continue;
      }

      console.log(`  ${editedAsset.filename}  →  sourceAssetId = ${histEntry.sourceAssetId}  (${histEntry.sourceFilename})`);
      if (apply) {
        await MediaAssetModel.updateOne(
          { id: histEntry.editedAssetId! },
          { $set: { sourceAssetId: histEntry.sourceAssetId } }
        );
      }
      sourceIdUpdated++;
    }

    console.log('');
    if (apply) {
      console.log(`MediaAsset.sourceAssetId: updated=${sourceIdUpdated}  already-set=${sourceIdAlreadySet}  conflict=${sourceIdConflict}  missing=${sourceIdMissing}`);
    } else {
      console.log(`MediaAsset.sourceAssetId: would-update=${sourceIdUpdated}  already-set=${sourceIdAlreadySet}  conflict=${sourceIdConflict}  missing=${sourceIdMissing}`);
    }
    console.log('');

    // ── Part 1: MediaAsset.editedAssetId ──────────────────────────────────────

    console.log('── Part 1: MediaAsset.editedAssetId ──────────────────────────────────');
    console.log('');

    // Track which source assets we've already handled to avoid double-processing.
    const handledSourceIds = new Set<string>();

    let assetUpdated = 0;
    let assetAlreadySet = 0;
    let assetConflict = 0;
    let assetSourceMissing = 0;

    // ── 1a. Primary path: edited assets with sourceAssetId in the DB ──────────

    const editedAssets = await MediaAssetModel
      .find({ sourceAssetId: { $exists: true, $ne: null } })
      .lean<MediaAsset[]>();

    console.log(`Primary path — edited assets with sourceAssetId: ${editedAssets.length}`);

    for (const edited of editedAssets) {
      const sourceId = edited.sourceAssetId!;
      handledSourceIds.add(sourceId);

      const source = await MediaAssetModel.findOne({ id: sourceId }).lean<MediaAsset>();
      if (!source) {
        console.warn(`  ⚠ Source asset ${sourceId} not found for "${edited.filename}" — skipping`);
        assetSourceMissing++;
        continue;
      }

      if (source.editedAssetId) {
        if (source.editedAssetId === edited.id) {
          assetAlreadySet++;
          continue;
        }
        console.warn(
          `  ⚠ "${source.filename}" already has editedAssetId="${source.editedAssetId}" ` +
          `(conflicts with "${edited.filename}" id=${edited.id}) — skipping`
        );
        assetConflict++;
        continue;
      }

      console.log(`  ${source.filename}  →  editedAssetId = ${edited.id}  (${edited.filename})`);
      if (apply) {
        await MediaAssetModel.updateOne({ id: sourceId }, { $set: { editedAssetId: edited.id } });
      }
      assetUpdated++;
    }

    // ── 1b. Fallback path: editHistory for legacy assets ──────────────────────

    // Filter to source assets not already handled above.
    const legacyHistory = succeededHistory.filter(
      (h) => !handledSourceIds.has(h.sourceAssetId)
    );

    console.log('');
    console.log(`Fallback path — editHistory succeeded entries for unhandled source assets: ${legacyHistory.length}`);

    for (const histEntry of legacyHistory) {
      handledSourceIds.add(histEntry.sourceAssetId);

      const source = await MediaAssetModel.findOne({ id: histEntry.sourceAssetId }).lean<MediaAsset>();
      if (!source) {
        console.warn(`  ⚠ Source asset ${histEntry.sourceAssetId} not found (history entry for "${histEntry.editedFilename}") — skipping`);
        assetSourceMissing++;
        continue;
      }

      if (source.editedAssetId) {
        if (source.editedAssetId === histEntry.editedAssetId) {
          assetAlreadySet++;
          continue;
        }
        console.warn(
          `  ⚠ "${source.filename}" already has editedAssetId="${source.editedAssetId}" ` +
          `(history has editedAssetId="${histEntry.editedAssetId}") — skipping`
        );
        assetConflict++;
        continue;
      }

      // Verify the edited asset actually exists in the DB.
      const editedAsset = await MediaAssetModel.findOne({ id: histEntry.editedAssetId! }).lean<MediaAsset>();
      if (!editedAsset) {
        console.warn(`  ⚠ Edited asset ${histEntry.editedAssetId} from history not found in DB — skipping`);
        assetSourceMissing++;
        continue;
      }

      console.log(`  ${source.filename}  →  editedAssetId = ${editedAsset.id}  (${editedAsset.filename})  [via editHistory]`);
      if (apply) {
        await MediaAssetModel.updateOne({ id: source.id }, { $set: { editedAssetId: editedAsset.id } });
      }
      assetUpdated++;
    }

    console.log('');
    if (apply) {
      console.log(`MediaAsset: updated=${assetUpdated}  already-set=${assetAlreadySet}  conflict=${assetConflict}  missing=${assetSourceMissing}`);
    } else {
      console.log(`MediaAsset: would-update=${assetUpdated}  already-set=${assetAlreadySet}  conflict=${assetConflict}  missing=${assetSourceMissing}`);
    }
    console.log('');

    // ── Part 2: EditQueueEntry.editedAssetId ──────────────────────────────────

    console.log('── Part 2: EditQueueEntry.editedAssetId ──────────────────────────────');
    console.log('');

    const pendingQueueEntries = await EditQueueEntryModel
      .find({ $or: [{ editedAssetId: null }, { editedAssetId: { $exists: false } }] })
      .lean<EditQueueEntry[]>();

    console.log(`Queue entries without editedAssetId: ${pendingQueueEntries.length}`);

    let queueUpdated = 0;
    let queueNoMatch = 0;
    let queueMultiple = 0;
    let queueAlreadySet = 0;

    for (const entry of pendingQueueEntries) {
      // Primary: find edited asset by sourceAssetId.
      const bySourceId = await MediaAssetModel
        .find({ sourceAssetId: entry.assetId })
        .lean<MediaAsset[]>();

      if (bySourceId.length === 1) {
        const editedAsset = bySourceId[0]!;
        console.log(`  assetId=${entry.assetId}  →  editedAssetId = ${editedAsset.id}  (${editedAsset.filename})`);
        if (apply) {
          await EditQueueEntryModel.updateOne({ assetId: entry.assetId }, { $set: { editedAssetId: editedAsset.id } });
        }
        queueUpdated++;
        continue;
      }

      if (bySourceId.length > 1) {
        console.warn(
          `  ⚠ assetId=${entry.assetId} — multiple edited assets by sourceAssetId ` +
          `(${bySourceId.map((m) => m.filename).join(', ')}) — skipping`
        );
        queueMultiple++;
        continue;
      }

      // Fallback: consult editHistory.
      const histEntries = succeededHistory.filter((h) => h.sourceAssetId === entry.assetId);

      if (histEntries.length === 0) {
        console.log(`  assetId=${entry.assetId}  — no imported edited asset found (not yet imported)`);
        queueNoMatch++;
        continue;
      }

      if (histEntries.length > 1) {
        console.warn(
          `  ⚠ assetId=${entry.assetId} — multiple editHistory entries ` +
          `(${histEntries.map((h) => h.editedFilename).join(', ')}) — skipping`
        );
        queueMultiple++;
        continue;
      }

      const histEntry = histEntries[0]!;
      // Verify edited asset exists.
      const editedAsset = await MediaAssetModel.findOne({ id: histEntry.editedAssetId! }).lean<MediaAsset>();
      if (!editedAsset) {
        console.warn(`  ⚠ assetId=${entry.assetId} — edited asset ${histEntry.editedAssetId} from history not found — skipping`);
        queueNoMatch++;
        continue;
      }

      console.log(`  assetId=${entry.assetId}  →  editedAssetId = ${editedAsset.id}  (${editedAsset.filename})  [via editHistory]`);
      if (apply) {
        await EditQueueEntryModel.updateOne({ assetId: entry.assetId }, { $set: { editedAssetId: editedAsset.id } });
      }
      queueUpdated++;
    }

    console.log('');
    if (apply) {
      console.log(`EditQueueEntry: updated=${queueUpdated}  already-set=${queueAlreadySet}  no-match=${queueNoMatch}  multiple=${queueMultiple}`);
    } else {
      console.log(`EditQueueEntry: would-update=${queueUpdated}  already-set=${queueAlreadySet}  no-match=${queueNoMatch}  multiple=${queueMultiple}`);
    }
    console.log('');

    // ── Summary ───────────────────────────────────────────────────────────────

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
