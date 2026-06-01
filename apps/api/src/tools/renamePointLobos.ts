/*
  One-time script: rename "Point Lobos" → "Point Reyes" in MongoDB.

  Updates:
    1. MediaAsset.originalArchivePath  (replaces "Point Lobos/" prefix)
    2. MediaAsset.displayArchivePath   (replaces "Point Lobos/" prefix, if set)
    3. AlbumTreeNode.label             (renames nodes labeled exactly "Point Lobos")

  Usage:
    Dry run:
      pnpm --filter @tedography/api exec tsx src/tools/renamePointLobos.ts

    Apply:
      pnpm --filter @tedography/api exec tsx src/tools/renamePointLobos.ts --apply
*/

import mongoose from 'mongoose';
import { connectToMongo } from '../db.js';
import { MediaAssetModel } from '../models/mediaAssetModel.js';
import { AlbumTreeNodeModel } from '../models/albumTreeNodeModel.js';

const OLD = 'Point Lobos';
const NEW = 'Point Reyes';

function parseArgs(argv: string[]): { apply: boolean } {
  for (const arg of argv) {
    if (arg === '--apply') return { apply: true };
    if (arg === '--help' || arg === '-h') {
      console.log('Usage: renamePointLobos.ts [--apply]');
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
    // ── 1. MediaAsset.originalArchivePath ────────────────────────────────────
    const regex = new RegExp(`^${OLD}(/|$)`);

    const assetsOriginal = await MediaAssetModel
      .find({ originalArchivePath: regex })
      .select({ id: 1, filename: 1, originalArchivePath: 1, displayArchivePath: 1 })
      .lean();

    console.log(`MediaAssets with originalArchivePath starting with "${OLD}": ${assetsOriginal.length}`);

    for (const asset of assetsOriginal) {
      const newOriginal = (asset.originalArchivePath as string).replace(OLD, NEW);
      const newDisplay = asset.displayArchivePath
        ? (asset.displayArchivePath as string).replace(new RegExp(`^${OLD}(/|$)`), (_, sep) => NEW + (sep ?? ''))
        : null;

      console.log(`  ${asset.filename}`);
      console.log(`    originalArchivePath: "${asset.originalArchivePath}" → "${newOriginal}"`);
      if (asset.displayArchivePath && newDisplay !== asset.displayArchivePath) {
        console.log(`    displayArchivePath:  "${asset.displayArchivePath}" → "${newDisplay}"`);
      }

      if (apply) {
        const setFields: Record<string, string> = { originalArchivePath: newOriginal };
        if (asset.displayArchivePath && newDisplay && newDisplay !== asset.displayArchivePath) {
          setFields['displayArchivePath'] = newDisplay;
        }
        await MediaAssetModel.updateOne({ id: asset.id }, { $set: setFields });
      }
    }

    console.log('');

    // ── 2. MediaAsset.displayArchivePath (if not already handled above) ──────
    const assetsDisplay = await MediaAssetModel
      .find({
        displayArchivePath: new RegExp(`^${OLD}(/|$)`),
        originalArchivePath: { $not: regex },
      })
      .select({ id: 1, filename: 1, displayArchivePath: 1 })
      .lean();

    console.log(`MediaAssets with displayArchivePath starting with "${OLD}" (not already handled): ${assetsDisplay.length}`);

    for (const asset of assetsDisplay) {
      const newDisplay = (asset.displayArchivePath as string).replace(OLD, NEW);
      console.log(`  ${asset.filename}  →  displayArchivePath: "${asset.displayArchivePath}" → "${newDisplay}"`);
      if (apply) {
        await MediaAssetModel.updateOne({ id: asset.id }, { $set: { displayArchivePath: newDisplay } });
      }
    }

    console.log('');

    // ── 3. AlbumTreeNode.label ────────────────────────────────────────────────
    const albumNodes = await AlbumTreeNodeModel
      .find({ label: OLD })
      .lean();

    console.log(`AlbumTreeNodes labeled "${OLD}": ${albumNodes.length}`);
    for (const node of albumNodes) {
      console.log(`  id=${node.id}  nodeType=${node.nodeType}  label="${node.label}" → "${NEW}"`);
      if (apply) {
        await AlbumTreeNodeModel.updateOne({ id: node.id }, { $set: { label: NEW } });
      }
    }

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
