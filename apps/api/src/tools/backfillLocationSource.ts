import mongoose from 'mongoose';
import { connectToMongo } from '../db.js';
import { log } from '../logger.js';
import { MediaAssetModel } from '../models/mediaAssetModel.js';

interface ScriptOptions {
  apply: boolean;
  limit: number | null;
  assetId: string | null;
}

interface BackfillSummary {
  candidates: number;
  processed: number;
  updated: number;
  failed: number;
}

function parseArgs(argv: string[]): ScriptOptions {
  let apply = false;
  let limit: number | null = null;
  let assetId: string | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]?.trim();
    if (!arg) {
      continue;
    }

    if (arg === '--apply') {
      apply = true;
      continue;
    }

    if (arg === '--limit') {
      const rawValue = argv[index + 1]?.trim();
      if (!rawValue) {
        throw new Error('Missing value for --limit');
      }

      const parsed = Number.parseInt(rawValue, 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error('--limit must be a positive integer');
      }

      limit = parsed;
      index += 1;
      continue;
    }

    if (arg.startsWith('--limit=')) {
      const parsed = Number.parseInt(arg.slice('--limit='.length), 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error('--limit must be a positive integer');
      }

      limit = parsed;
      continue;
    }

    if (arg === '--asset-id') {
      const value = argv[index + 1]?.trim();
      if (!value) {
        throw new Error('Missing value for --asset-id');
      }

      assetId = value;
      index += 1;
      continue;
    }

    if (arg.startsWith('--asset-id=')) {
      const value = arg.slice('--asset-id='.length).trim();
      if (value.length === 0) {
        throw new Error('Missing value for --asset-id');
      }

      assetId = value;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    }
  }

  return { apply, limit, assetId };
}

function printUsage(): void {
  console.log(`Stamp locationSource: 'exif' on assets that already have location data
(from before the locationSource field existed) but no locationSource set.
Never touches assets that already have a locationSource — those were either
classified by a more recent import/reimport, or set manually/inherited.

Usage:
  pnpm --filter @tedography/api exec tsx src/tools/backfillLocationSource.ts [--apply] [--limit N] [--asset-id ID]

Options:
  --apply         Persist updates. Without this flag, the script runs in dry-run mode.
  --limit N       Process at most N candidate assets.
  --asset-id ID   Restrict processing to one asset id.
`);
}

async function buildCandidateQuery(options: ScriptOptions): Promise<Record<string, unknown>> {
  const query: Record<string, unknown> = {
    locationSource: { $in: [null, undefined] },
    $or: [
      { locationLatitude: { $type: 'number' } },
      { locationLongitude: { $type: 'number' } },
      { locationLabel: { $type: 'string', $ne: '' } }
    ]
  };

  if (options.assetId) {
    query.id = options.assetId;
  }

  return query;
}

async function runBackfill(options: ScriptOptions): Promise<BackfillSummary> {
  const summary: BackfillSummary = { candidates: 0, processed: 0, updated: 0, failed: 0 };

  const query = await buildCandidateQuery(options);
  const candidates = await MediaAssetModel.find(
    query,
    { _id: 0, id: 1, filename: 1 }
  )
    .sort({ importedAt: 1, id: 1 })
    .limit(options.limit ?? 0)
    .lean<Array<{ id: string; filename: string }>>();

  summary.candidates = candidates.length;

  for (const asset of candidates) {
    summary.processed += 1;

    try {
      if (options.apply) {
        await MediaAssetModel.updateOne({ id: asset.id }, { $set: { locationSource: 'exif' } });
      }

      summary.updated += 1;
      log.info(`[${options.apply ? 'updated' : 'dry-run'}] ${asset.id} | ${asset.filename} -> locationSource: exif`);
    } catch (error) {
      summary.failed += 1;
      log.error(`Failed to backfill locationSource for asset ${asset.id} (${asset.filename})`, error);
    }
  }

  return summary;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  log.info(
    `Starting locationSource backfill in ${options.apply ? 'apply' : 'dry-run'} mode${options.limit ? ` (limit=${options.limit})` : ''}${options.assetId ? ` (assetId=${options.assetId})` : ''}`
  );

  await connectToMongo();

  try {
    const summary = await runBackfill(options);
    log.info(
      `locationSource backfill summary: candidates=${summary.candidates}, processed=${summary.processed}, updated=${summary.updated}, failed=${summary.failed}`
    );

    if (!options.apply) {
      log.info('Dry-run only. Re-run with --apply to persist changes.');
    }

    if (summary.failed > 0) {
      process.exitCode = 1;
    }
  } finally {
    await mongoose.disconnect();
    log.info('Disconnected from MongoDB');
  }
}

void main();
