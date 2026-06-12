import mongoose from 'mongoose';
import { getEffectiveAlbumSortTime, sortAssetsForSmartAlbumOrder } from '@tedography/shared';
import { connectToMongo } from '../db.js';
import { log } from '../logger.js';
import { MediaAssetModel } from '../models/mediaAssetModel.js';
import {
  applyAlbumPlacementUpdates,
  findAssetsByAlbumId
} from '../repositories/assetRepository.js';

interface ScriptOptions {
  apply: boolean;
  albumId: string | null;
}

const SEED_GAP_MS = 1000;

function parseArgs(argv: string[]): ScriptOptions {
  const options: ScriptOptions = { apply: false, albumId: null };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]?.trim();
    if (!arg) {
      continue;
    }

    if (arg === '--apply') {
      options.apply = true;
      continue;
    }

    if (arg === '--album-id' || arg.startsWith('--album-id=')) {
      const value =
        arg === '--album-id' ? argv[(index += 1)]?.trim() : arg.slice('--album-id='.length).trim();
      if (!value) {
        throw new Error('Missing value for --album-id');
      }
      options.albumId = value;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      console.log(`Seed manualSortTime for legacy manual-section photos.

For every album with forceManualOrder photos that lack a manualSortTime, assigns
virtual times after the album's last timed photo, preserving today's visible
order exactly. Writes nothing without --apply.

Usage:
  pnpm manual-sort:migrate [--apply] [--album-id ID]
`);
      process.exit(0);
    }
  }

  return options;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  log.info(`Starting manualSortTime migration in ${options.apply ? 'APPLY' : 'dry-run'} mode`);

  await connectToMongo();

  try {
    let albumIds: string[];
    if (options.albumId) {
      albumIds = [options.albumId];
    } else {
      albumIds = (await MediaAssetModel.distinct('albumMemberships.albumId', {
        albumMemberships: { $elemMatch: { forceManualOrder: true, manualSortTime: { $eq: null } } }
      })) as string[];
    }

    log.info(`Albums with legacy manual photos to seed: ${albumIds.length}`);

    let totalSeeded = 0;
    for (const albumId of albumIds) {
      const albumAssets = await findAssetsByAlbumId(albumId);
      const sorted = sortAssetsForSmartAlbumOrder(albumAssets, albumId);

      const baseTime = sorted.reduce<number | null>((max, asset) => {
        const time = getEffectiveAlbumSortTime(asset, albumId);
        return time !== null && (max === null || time > max) ? time : max;
      }, null);

      // Legacy candidates, in their current visible order.
      const candidates = sorted.filter((asset) => {
        const membership = asset.albumMemberships?.find((m) => m.albumId === albumId);
        return (
          membership?.forceManualOrder === true &&
          !(typeof membership.manualSortTime === 'number' && Number.isFinite(membership.manualSortTime))
        );
      });

      if (candidates.length === 0) {
        continue;
      }

      const seedBase = baseTime ?? 0;
      const updates = candidates.map((asset, index) => ({
        assetId: asset.id,
        manualSortTime: seedBase + (index + 1) * SEED_GAP_MS
      }));

      log.info(
        `[${options.apply ? 'apply' : 'dry-run'}] album ${albumId}: seeding ${updates.length} photos after ${
          baseTime !== null ? new Date(baseTime).toISOString() : 'epoch (no timed photos)'
        } — ${candidates
          .slice(0, 5)
          .map((asset) => asset.filename)
          .join(', ')}${candidates.length > 5 ? ', …' : ''}`
      );

      if (options.apply) {
        await applyAlbumPlacementUpdates(albumId, updates);
      }
      totalSeeded += updates.length;
    }

    log.info(
      `Migration summary: ${totalSeeded} photos across ${albumIds.length} albums ${
        options.apply ? 'seeded' : 'would be seeded'
      }`
    );
    if (!options.apply) {
      log.info('Dry-run only. Re-run with --apply to persist.');
    }
  } finally {
    await mongoose.disconnect();
    log.info('Disconnected from MongoDB');
  }
}

void main();
