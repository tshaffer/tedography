/*
Usage:
  cd /Users/tedshaffer/Documents/Projects/tedography
  export MONGODB_URI="<your mongodb uri>"

Dry run:
  pnpm --filter @tedography/api exec tsx src/tools/discardSuppressedDuplicates.ts

Apply changes:
  pnpm --filter @tedography/api exec tsx src/tools/discardSuppressedDuplicates.ts --apply
*/

import mongoose from 'mongoose';
import { PhotoState } from '@tedography/domain';
import { MediaAssetModel } from '../models/mediaAssetModel.js';
import { listDuplicateGroupResolutions } from '../repositories/duplicateGroupResolutionRepository.js';
import { resolveSelectedCanonicalAssetId } from '../services/duplicateGroupService.js';

interface ScriptOptions {
  apply: boolean;
}

interface SuppressedDuplicateSummary {
  confirmedGroups: number;
  suppressedDuplicateAssets: number;
  alreadyDiscard: number;
  willChange: number;
  updated: number;
}

function requireMongoUri(): string {
  const value = process.env.MONGODB_URI?.trim();
  if (!value) {
    throw new Error('Missing required environment variable: MONGODB_URI');
  }

  return value;
}

function parseArgs(argv: string[]): ScriptOptions {
  let apply = false;

  for (const rawArg of argv) {
    const arg = rawArg.trim();
    if (!arg) {
      continue;
    }

    if (arg === '--apply') {
      apply = true;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return { apply };
}

function printUsage(): void {
  console.log(`Set confirmed suppressed duplicates to PhotoState.Discard.

Usage:
  pnpm --filter @tedography/api exec tsx src/tools/discardSuppressedDuplicates.ts
  pnpm --filter @tedography/api exec tsx src/tools/discardSuppressedDuplicates.ts --apply

Options:
  --apply   Persist updates. Without this flag, the script runs in dry-run mode.
`);
}

async function listSuppressedDuplicateAssetIds(): Promise<string[]> {
  const confirmedResolutions = await listDuplicateGroupResolutions({
    resolutionStatus: 'confirmed'
  });

  const suppressedAssetIds = new Set<string>();

  for (const resolution of confirmedResolutions) {
    const selectedCanonicalAssetId = resolveSelectedCanonicalAssetId({
      assetIds: resolution.assetIds,
      proposedCanonicalAssetId: resolution.proposedCanonicalAssetId,
      ...(resolution.manualCanonicalAssetId !== undefined
        ? { manualCanonicalAssetId: resolution.manualCanonicalAssetId }
        : {})
    });

    for (const assetId of resolution.assetIds) {
      if (assetId !== selectedCanonicalAssetId) {
        suppressedAssetIds.add(assetId);
      }
    }
  }

  return Array.from(suppressedAssetIds);
}

async function summarizeSuppressedDuplicates(apply: boolean): Promise<SuppressedDuplicateSummary> {
  const confirmedResolutions = await listDuplicateGroupResolutions({
    resolutionStatus: 'confirmed'
  });
  const suppressedDuplicateAssetIds = await listSuppressedDuplicateAssetIds();

  if (suppressedDuplicateAssetIds.length === 0) {
    return {
      confirmedGroups: confirmedResolutions.length,
      suppressedDuplicateAssets: 0,
      alreadyDiscard: 0,
      willChange: 0,
      updated: 0
    };
  }

  const alreadyDiscard = await MediaAssetModel.countDocuments({
    id: { $in: suppressedDuplicateAssetIds },
    photoState: PhotoState.Discard
  });

  const willChange = await MediaAssetModel.countDocuments({
    id: { $in: suppressedDuplicateAssetIds },
    photoState: { $ne: PhotoState.Discard }
  });

  let updated = 0;
  if (apply && willChange > 0) {
    const result = await MediaAssetModel.updateMany(
      {
        id: { $in: suppressedDuplicateAssetIds },
        photoState: { $ne: PhotoState.Discard }
      },
      {
        $set: {
          photoState: PhotoState.Discard
        }
      }
    );

    updated = result.modifiedCount;
  }

  return {
    confirmedGroups: confirmedResolutions.length,
    suppressedDuplicateAssets: suppressedDuplicateAssetIds.length,
    alreadyDiscard,
    willChange,
    updated
  };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const mongoUri = requireMongoUri();

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  const summary = await summarizeSuppressedDuplicates(options.apply);

  console.log('');
  console.log('Suppressed duplicate summary:');
  console.log(`  confirmed duplicate groups: ${String(summary.confirmedGroups).padStart(12)}`);
  console.log(`  suppressed duplicate assets: ${String(summary.suppressedDuplicateAssets).padStart(10)}`);
  console.log(`  already Discard: ${String(summary.alreadyDiscard).padStart(22)}`);
  console.log(`  will change to Discard: ${String(summary.willChange).padStart(15)}`);

  if (options.apply) {
    console.log(`  updated this run: ${String(summary.updated).padStart(19)}`);
  } else {
    console.log('  mode: dry run (no changes written)');
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
