import fs from 'node:fs/promises';
import mongoose from 'mongoose';
import { type MediaAsset } from '@tedography/domain';
import { connectToMongo } from '../db.js';
import { buildThumbnailDerivedRelativePath, resolveDerivedAbsolutePath } from '../import/derivedStorage.js';
import { generateJpegThumbnail } from '../import/thumbnailGeneration.js';
import { log } from '../logger.js';
import { resolveDisplayAbsolutePathForAsset } from '../media/resolveAssetMediaPath.js';
import { findPhotoAssets, updateThumbnailReferenceFields } from '../repositories/assetRepository.js';

type MaintenanceMode = 'verify' | 'repair' | 'rebuild';

type VerifySummary = {
  assetsChecked: number;
  thumbnailsPresent: number;
  thumbnailsMissing: number;
  errors: number;
};

type RepairSummary = {
  assetsChecked: number;
  thumbnailsAlreadyPresent: number;
  thumbnailsRegenerated: number;
  skipped: number;
  referencesUpdated: number;
  errors: number;
};

type RebuildSummary = {
  assetsChecked: number;
  thumbnailsRegenerated: number;
  referencesUpdated: number;
  errors: number;
};

function parseMode(argv: string[]): MaintenanceMode {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg) {
      continue;
    }

    if (arg === '--mode') {
      const value = argv[index + 1]?.trim().toLowerCase();
      if (value === 'verify' || value === 'repair' || value === 'rebuild') {
        return value;
      }
      continue;
    }

    if (arg.startsWith('--mode=')) {
      const value = arg.slice('--mode='.length).trim().toLowerCase();
      if (value === 'verify' || value === 'repair' || value === 'rebuild') {
        return value;
      }
      continue;
    }

    const value = arg.trim().toLowerCase();
    if (value === 'verify' || value === 'repair' || value === 'rebuild') {
      return value;
    }
  }

  throw new Error('Mode is required. Use --mode verify|repair|rebuild');
}

async function fileExists(absolutePath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(absolutePath);
    return stat.isFile() && stat.size > 0;
  } catch {
    return false;
  }
}

function getExpectedThumbnailDerivedPath(asset: MediaAsset): string {
  return buildThumbnailDerivedRelativePath(asset.originalContentHash);
}

function getThumbnailReferenceIsExpected(asset: MediaAsset, expectedDerivedPath: string): boolean {
  return (
    asset.thumbnailStorageType === 'derived-root' &&
    asset.thumbnailDerivedPath === expectedDerivedPath &&
    asset.thumbnailFileFormat === 'jpg'
  );
}

async function ensureThumbnailReferenceFields(
  asset: MediaAsset,
  expectedDerivedPath: string
): Promise<boolean> {
  if (getThumbnailReferenceIsExpected(asset, expectedDerivedPath)) {
    return false;
  }

  const updated = await updateThumbnailReferenceFields({
    id: asset.id,
    thumbnailStorageType: 'derived-root',
    thumbnailDerivedPath: expectedDerivedPath,
    thumbnailFileFormat: 'jpg'
  });

  if (!updated) {
    throw new Error(`Failed to update thumbnail reference fields for asset ${asset.id}`);
  }

  return true;
}

async function verifyThumbnails(): Promise<VerifySummary> {
  const summary: VerifySummary = {
    assetsChecked: 0,
    thumbnailsPresent: 0,
    thumbnailsMissing: 0,
    errors: 0
  };

  const missingSamples: string[] = [];
  const assets = await findPhotoAssets();
  for (const asset of assets) {
    summary.assetsChecked += 1;

    try {
      const expectedDerivedPath = getExpectedThumbnailDerivedPath(asset);
      const expectedAbsolutePath = resolveDerivedAbsolutePath(expectedDerivedPath);
      const exists = await fileExists(expectedAbsolutePath);

      if (exists) {
        summary.thumbnailsPresent += 1;
      } else {
        summary.thumbnailsMissing += 1;
        if (missingSamples.length < 10) {
          missingSamples.push(`${asset.id} | ${asset.filename} | ${expectedDerivedPath}`);
        }
      }
    } catch (error) {
      summary.errors += 1;
      log.error(`Thumbnail verify failed for asset ${asset.id} (${asset.filename})`, error);
    }
  }

  log.info(
    `Thumbnail verify summary: checked=${summary.assetsChecked}, present=${summary.thumbnailsPresent}, missing=${summary.thumbnailsMissing}, errors=${summary.errors}`
  );

  if (missingSamples.length > 0) {
    log.warn('Sample missing thumbnails (up to 10):');
    for (const sample of missingSamples) {
      log.warn(`  ${sample}`);
    }
  }

  return summary;
}

async function repairThumbnails(): Promise<RepairSummary> {
  const summary: RepairSummary = {
    assetsChecked: 0,
    thumbnailsAlreadyPresent: 0,
    thumbnailsRegenerated: 0,
    skipped: 0,
    referencesUpdated: 0,
    errors: 0
  };

  const assets = await findPhotoAssets();
  for (const asset of assets) {
    summary.assetsChecked += 1;

    try {
      const expectedDerivedPath = getExpectedThumbnailDerivedPath(asset);
      const expectedAbsolutePath = resolveDerivedAbsolutePath(expectedDerivedPath);
      const exists = await fileExists(expectedAbsolutePath);

      if (exists) {
        summary.thumbnailsAlreadyPresent += 1;
        summary.skipped += 1;
      } else {
        const displayAbsolutePath = resolveDisplayAbsolutePathForAsset(asset);
        await generateJpegThumbnail({
          sourceAbsolutePath: displayAbsolutePath,
          targetAbsolutePath: expectedAbsolutePath
        });

        summary.thumbnailsRegenerated += 1;
      }

      if (await ensureThumbnailReferenceFields(asset, expectedDerivedPath)) {
        summary.referencesUpdated += 1;
      }
    } catch (error) {
      summary.errors += 1;
      log.error(`Thumbnail repair failed for asset ${asset.id} (${asset.filename})`, error);
    }
  }

  log.info(
    `Thumbnail repair summary: checked=${summary.assetsChecked}, alreadyPresent=${summary.thumbnailsAlreadyPresent}, regenerated=${summary.thumbnailsRegenerated}, skipped=${summary.skipped}, referencesUpdated=${summary.referencesUpdated}, errors=${summary.errors}`
  );

  return summary;
}

async function rebuildThumbnails(): Promise<RebuildSummary> {
  const summary: RebuildSummary = {
    assetsChecked: 0,
    thumbnailsRegenerated: 0,
    referencesUpdated: 0,
    errors: 0
  };

  const assets = await findPhotoAssets();
  for (const asset of assets) {
    summary.assetsChecked += 1;

    try {
      const expectedDerivedPath = getExpectedThumbnailDerivedPath(asset);
      const expectedAbsolutePath = resolveDerivedAbsolutePath(expectedDerivedPath);
      const displayAbsolutePath = resolveDisplayAbsolutePathForAsset(asset);

      await generateJpegThumbnail({
        sourceAbsolutePath: displayAbsolutePath,
        targetAbsolutePath: expectedAbsolutePath,
        forceRegenerate: true
      });

      summary.thumbnailsRegenerated += 1;

      if (await ensureThumbnailReferenceFields(asset, expectedDerivedPath)) {
        summary.referencesUpdated += 1;
      }
    } catch (error) {
      summary.errors += 1;
      log.error(`Thumbnail rebuild failed for asset ${asset.id} (${asset.filename})`, error);
    }
  }

  log.info(
    `Thumbnail rebuild summary: checked=${summary.assetsChecked}, regenerated=${summary.thumbnailsRegenerated}, referencesUpdated=${summary.referencesUpdated}, errors=${summary.errors}`
  );

  return summary;
}

async function run(): Promise<void> {
  const mode = parseMode(process.argv.slice(2));
  log.info(`Starting thumbnail maintenance mode="${mode}"`);

  await connectToMongo();

  try {
    if (mode === 'verify') {
      const summary = await verifyThumbnails();
      if (summary.errors > 0) {
        process.exitCode = 1;
      }
      return;
    }

    if (mode === 'repair') {
      const summary = await repairThumbnails();
      if (summary.errors > 0) {
        process.exitCode = 1;
      }
      return;
    }

    const summary = await rebuildThumbnails();
    if (summary.errors > 0) {
      process.exitCode = 1;
    }
  } finally {
    await mongoose.disconnect();
    log.info('Disconnected from MongoDB');
  }
}

void run();
