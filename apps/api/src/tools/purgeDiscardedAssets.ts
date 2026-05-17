/*
  Deletes all mediaAssets with photoState=Discard, then removes any documents in
  faceDetections, faceMatchReviews, personFaceExamples, and imageAnalyses that
  referenced those now-deleted assets.

  Runs as a dry run by default. Pass --apply to commit all deletions.

Usage:
  Dry run (no changes written):
    pnpm --filter @tedography/api exec tsx src/tools/purgeDiscardedAssets.ts

  Apply deletions:
    pnpm --filter @tedography/api exec tsx src/tools/purgeDiscardedAssets.ts --apply
*/

import mongoose from 'mongoose';
import { PhotoState } from '@tedography/domain';
import { connectToMongo } from '../db.js';
import { MediaAssetModel } from '../models/mediaAssetModel.js';
import { FaceDetectionModel } from '../models/faceDetectionModel.js';
import { FaceMatchReviewModel } from '../models/faceMatchReviewModel.js';
import { PersonFaceExampleModel } from '../models/personFaceExampleModel.js';
import { ImageAnalysisModel } from '../models/imageAnalysisModel.js';

interface CollectionResult {
  collection: string;
  orphanCount: number;
  deletedCount: number;
}

interface PurgeReport {
  discardedAssetCount: number;
  deletedAssetCount: number;
  collections: CollectionResult[];
  totalOrphans: number;
  totalDeleted: number;
}

function parseArgs(argv: string[]): { apply: boolean } {
  for (const arg of argv) {
    if (arg === '--apply') return { apply: true };
    if (arg === '--help' || arg === '-h') {
      console.log('Usage: purgeDiscardedAssets.ts [--apply]');
      console.log('  --apply   Commit all deletions. Without this flag, runs in dry-run mode.');
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return { apply: false };
}

async function pruneCollection(
  label: string,
  idField: string,
  model: mongoose.Model<unknown>,
  discardedAssetIds: Set<string>,
  apply: boolean
): Promise<CollectionResult> {
  const orphanCount = await model.countDocuments({ [idField]: { $in: Array.from(discardedAssetIds) } });

  let deletedCount = 0;
  if (apply && orphanCount > 0) {
    const result = await model.deleteMany({ [idField]: { $in: Array.from(discardedAssetIds) } });
    deletedCount = result.deletedCount;
  }

  return { collection: label, orphanCount, deletedCount };
}

async function run(): Promise<void> {
  const { apply } = parseArgs(process.argv.slice(2));

  console.log(`Mode: ${apply ? 'APPLY (deletions will be written)' : 'dry run (no changes written)'}`);
  console.log('');

  await connectToMongo();

  try {
    const discardedAssets = await MediaAssetModel.find(
      { photoState: PhotoState.Discard },
      { id: 1, _id: 0 }
    ).lean();
    const discardedAssetIds = new Set(discardedAssets.map((a) => a.id));

    const assetNote = apply ? '' : ' (would be deleted)';
    console.log(`mediaAssets with photoState=Discard: ${discardedAssetIds.size}${assetNote}`);

    if (discardedAssetIds.size === 0) {
      console.log('Nothing to do.');
      return;
    }

    let deletedAssetCount = 0;
    if (apply) {
      const result = await MediaAssetModel.deleteMany({ photoState: PhotoState.Discard });
      deletedAssetCount = result.deletedCount;
      console.log(`Deleted ${deletedAssetCount} mediaAssets.`);
    }

    console.log('');
    console.log('Checking dependent collections for orphaned references...');
    console.log('');

    const results: CollectionResult[] = await Promise.all([
      pruneCollection('faceDetections', 'mediaAssetId', FaceDetectionModel, discardedAssetIds, apply),
      pruneCollection('faceMatchReviews', 'mediaAssetId', FaceMatchReviewModel, discardedAssetIds, apply),
      pruneCollection('personFaceExamples', 'mediaAssetId', PersonFaceExampleModel, discardedAssetIds, apply),
      pruneCollection('imageAnalyses', 'assetId', ImageAnalysisModel, discardedAssetIds, apply),
    ]);

    const report: PurgeReport = {
      discardedAssetCount: discardedAssetIds.size,
      deletedAssetCount,
      collections: results,
      totalOrphans: results.reduce((sum, r) => sum + r.orphanCount, 0),
      totalDeleted: results.reduce((sum, r) => sum + r.deletedCount, 0),
    };

    const colHeader = apply ? 'deleted' : 'would delete';
    console.log('Orphaned references per collection:');
    for (const r of report.collections) {
      console.log(`  ${r.collection.padEnd(20)} ${colHeader}: ${String(apply ? r.deletedCount : r.orphanCount).padStart(6)}`);
    }
    console.log('');
    console.log(`  ${'TOTAL'.padEnd(20)} ${colHeader}: ${String(apply ? report.totalDeleted : report.totalOrphans).padStart(6)}`);

    if (!apply) {
      console.log('');
      console.log('Run with --apply to delete the discarded assets and their orphaned references.');
    }
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
