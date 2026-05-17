/*
  Finds and removes documents in faceDetections, faceMatchReviews, personFaceExamples,
  and imageAnalyses that reference mediaAsset IDs which no longer exist.

  This can happen when mediaAssets are deleted directly (e.g. via mongosh deleteMany)
  without cascading to dependent collections.

Usage:
  Dry run (no changes written):
    pnpm --filter @tedography/api exec tsx src/tools/pruneOrphanedAssetReferences.ts

  Apply deletions:
    pnpm --filter @tedography/api exec tsx src/tools/pruneOrphanedAssetReferences.ts --apply
*/

import mongoose from 'mongoose';
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

interface PruneReport {
  liveAssetCount: number;
  collections: CollectionResult[];
  totalOrphans: number;
  totalDeleted: number;
}

function parseArgs(argv: string[]): { apply: boolean } {
  for (const arg of argv) {
    if (arg === '--apply') return { apply: true };
    if (arg === '--help' || arg === '-h') {
      console.log('Usage: pruneOrphanedAssetReferences.ts [--apply]');
      console.log('  --apply   Delete orphaned documents. Without this flag, runs in dry-run mode.');
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
  liveAssetIds: Set<string>,
  apply: boolean
): Promise<CollectionResult> {
  const allDocs = await model.find({}, { [idField]: 1, _id: 0 }).lean();
  const orphanedIds = (allDocs as unknown as Record<string, string>[])
    .map((doc) => doc[idField])
    .filter((id) => id != null && !liveAssetIds.has(id));

  let deletedCount = 0;
  if (apply && orphanedIds.length > 0) {
    const result = await model.deleteMany({ [idField]: { $in: orphanedIds } });
    deletedCount = result.deletedCount;
  }

  return { collection: label, orphanCount: orphanedIds.length, deletedCount };
}

async function run(): Promise<void> {
  const { apply } = parseArgs(process.argv.slice(2));

  console.log(`Mode: ${apply ? 'APPLY (deletions will be written)' : 'dry run (no changes written)'}`);
  console.log('');

  await connectToMongo();

  try {
    const liveAssets = await MediaAssetModel.find({}, { id: 1, _id: 0 }).lean();
    const liveAssetIds = new Set(liveAssets.map((a) => a.id));
    console.log(`Live mediaAssets: ${liveAssetIds.size}`);
    console.log('');

    const results: CollectionResult[] = await Promise.all([
      pruneCollection('faceDetections', 'mediaAssetId', FaceDetectionModel, liveAssetIds, apply),
      pruneCollection('faceMatchReviews', 'mediaAssetId', FaceMatchReviewModel, liveAssetIds, apply),
      pruneCollection('personFaceExamples', 'mediaAssetId', PersonFaceExampleModel, liveAssetIds, apply),
      pruneCollection('imageAnalyses', 'assetId', ImageAnalysisModel, liveAssetIds, apply),
    ]);

    const report: PruneReport = {
      liveAssetCount: liveAssetIds.size,
      collections: results,
      totalOrphans: results.reduce((sum, r) => sum + r.orphanCount, 0),
      totalDeleted: results.reduce((sum, r) => sum + r.deletedCount, 0),
    };

    console.log('Orphaned reference summary:');
    for (const r of report.collections) {
      const deletedNote = apply ? `, deleted: ${r.deletedCount}` : '';
      console.log(`  ${r.collection.padEnd(20)} orphans: ${String(r.orphanCount).padStart(6)}${deletedNote}`);
    }
    console.log('');
    console.log(`  ${'TOTAL'.padEnd(20)} orphans: ${String(report.totalOrphans).padStart(6)}${apply ? `, deleted: ${report.totalDeleted}` : ''}`);

    if (!apply && report.totalOrphans > 0) {
      console.log('');
      console.log('Run with --apply to delete these orphaned documents.');
    }

    if (report.totalOrphans === 0) {
      console.log('');
      console.log('No orphaned references found.');
    }
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
