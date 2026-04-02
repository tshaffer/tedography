import mongoose from 'mongoose';
import { PhotoState } from '@tedography/domain';
import { connectToMongo } from '../db.js';
import { reverseGeocodeCoordinates } from '../import/exifMetadata.js';
import { log } from '../logger.js';
import { MediaAssetModel } from '../models/mediaAssetModel.js';
import { listDuplicateGroupResolutions } from '../repositories/duplicateGroupResolutionRepository.js';
import { resolveSelectedCanonicalAssetId } from '../services/duplicateGroupService.js';

interface ScriptOptions {
  apply: boolean;
  limit: number | null;
  assetId: string | null;
}

interface BackfillSummary {
  candidates: number;
  processed: number;
  updated: number;
  unchanged: number;
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

  return {
    apply,
    limit,
    assetId
  };
}

function printUsage(): void {
  console.log(`Backfill reverse-geocoded asset location fields.

Usage:
  pnpm --filter @tedography/api exec tsx src/tools/backfillAssetLocations.ts [--apply] [--limit N] [--asset-id ID]

Options:
  --apply         Persist updates. Without this flag, the script runs in dry-run mode.
  --limit N       Process at most N candidate assets.
  --asset-id ID   Restrict processing to one asset id.
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

async function buildFilteredCandidateQuery(options: ScriptOptions): Promise<Record<string, unknown>> {
  const allReverseGeocodeFieldsMissing = [
    {
      $or: [{ city: { $exists: false } }, { city: null }, { city: '' }]
    },
    {
      $or: [{ state: { $exists: false } }, { state: null }, { state: '' }]
    },
    {
      $or: [{ country: { $exists: false } }, { country: null }, { country: '' }]
    }
  ];

  const suppressedDuplicateAssetIds = await listSuppressedDuplicateAssetIds();
  const query: Record<string, unknown> = {
    photoState: { $ne: PhotoState.Discard },
    locationLatitude: { $type: 'number' },
    locationLongitude: { $type: 'number' },
    $and: allReverseGeocodeFieldsMissing
  };

  if (suppressedDuplicateAssetIds.length > 0) {
    query.id = { $nin: suppressedDuplicateAssetIds };
  }

  if (options.assetId) {
    query.id = options.assetId;
    if (suppressedDuplicateAssetIds.includes(options.assetId)) {
      query.id = '__suppressed_duplicate_asset__';
    }
  }

  return query;
}

async function runBackfill(options: ScriptOptions): Promise<BackfillSummary> {
  const summary: BackfillSummary = {
    candidates: 0,
    processed: 0,
    updated: 0,
    unchanged: 0,
    failed: 0
  };

  const query = await buildFilteredCandidateQuery(options);
  const candidates = await MediaAssetModel.find(
    query,
    {
      _id: 0,
      id: 1,
      filename: 1,
      locationLatitude: 1,
      locationLongitude: 1,
      city: 1,
      state: 1,
      country: 1
    }
  )
    .sort({ importedAt: 1, id: 1 })
    .limit(options.limit ?? 0)
    .lean<
      Array<{
        id: string;
        filename: string;
        locationLatitude: number;
        locationLongitude: number;
        city?: string | null;
        state?: string | null;
        country?: string | null;
      }>
    >();

  summary.candidates = candidates.length;

  for (const asset of candidates) {
    summary.processed += 1;

    try {
      const reverseGeocodedLocation = await reverseGeocodeCoordinates(
        asset.locationLatitude,
        asset.locationLongitude
      );

      const nextCity = reverseGeocodedLocation.city;
      const nextState = reverseGeocodedLocation.state;
      const nextCountry = reverseGeocodedLocation.country;

      const isChanged =
        (asset.city ?? null) !== nextCity ||
        (asset.state ?? null) !== nextState ||
        (asset.country ?? null) !== nextCountry;

      if (!isChanged) {
        summary.unchanged += 1;
        log.info(
          `[unchanged] ${asset.id} | ${asset.filename} | ${nextCity ?? '—'} | ${nextState ?? '—'} | ${nextCountry ?? '—'}`
        );
        continue;
      }

      if (options.apply) {
        await MediaAssetModel.updateOne(
          { id: asset.id },
          {
            $set: {
              city: nextCity,
              state: nextState,
              country: nextCountry
            }
          },
          { runValidators: true }
        );
      }

      summary.updated += 1;
      log.info(
        `[${options.apply ? 'updated' : 'dry-run'}] ${asset.id} | ${asset.filename} | ${asset.city ?? '—'} -> ${nextCity ?? '—'} | ${asset.state ?? '—'} -> ${nextState ?? '—'} | ${asset.country ?? '—'} -> ${nextCountry ?? '—'}`
      );
    } catch (error) {
      summary.failed += 1;
      log.error(`Failed to backfill location for asset ${asset.id} (${asset.filename})`, error);
    }
  }

  return summary;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  log.info(
    `Starting asset location backfill in ${options.apply ? 'apply' : 'dry-run'} mode${options.limit ? ` (limit=${options.limit})` : ''}${options.assetId ? ` (assetId=${options.assetId})` : ''}`
  );

  await connectToMongo();

  try {
    const summary = await runBackfill(options);
    log.info(
      `Asset location backfill summary: candidates=${summary.candidates}, processed=${summary.processed}, updated=${summary.updated}, unchanged=${summary.unchanged}, failed=${summary.failed}`
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
