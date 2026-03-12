import fs from 'node:fs/promises';
import type { Stats } from 'node:fs';
import mongoose from 'mongoose';
import { MediaType, type MediaAsset } from '@tedography/domain';
import { connectToMongo } from '../db.js';
import { resolveDerivedAbsolutePath } from '../import/derivedStorage.js';
import { getStorageRootById } from '../import/storageRoots.js';
import { resolveSafeAbsolutePath } from '../import/storagePathUtils.js';
import { log } from '../logger.js';
import { getAllAssets } from '../repositories/assetRepository.js';

type AssetIntegrityProblemCategory =
  | 'MissingOriginalFile'
  | 'MissingDisplayFile'
  | 'MissingThumbnailFile'
  | 'InvalidOriginalReference'
  | 'InvalidDisplayReference'
  | 'InvalidThumbnailReference'
  | 'MissingStorageRoot'
  | 'FileSizeMismatch'
  | 'Other';

interface AssetIntegrityProblem {
  assetId: string;
  filename: string;
  category: AssetIntegrityProblemCategory;
  message: string;
}

interface AssetIntegritySummary {
  assetsChecked: number;
  assetsWithNoProblems: number;
  assetsWithProblems: number;
  missingOriginals: number;
  missingDisplays: number;
  missingThumbnails: number;
  invalidOriginalReferences: number;
  invalidDisplayReferences: number;
  invalidThumbnailReferences: number;
  missingStorageRoots: number;
  fileSizeMismatches: number;
  otherProblems: number;
}

interface AssetIntegrityVerificationResult {
  summary: AssetIntegritySummary;
  problems: AssetIntegrityProblem[];
}

const maxProblemSamples = 50;

function parseJsonOutputFlag(argv: string[]): boolean {
  return argv.includes('--json');
}

function createEmptySummary(): AssetIntegritySummary {
  return {
    assetsChecked: 0,
    assetsWithNoProblems: 0,
    assetsWithProblems: 0,
    missingOriginals: 0,
    missingDisplays: 0,
    missingThumbnails: 0,
    invalidOriginalReferences: 0,
    invalidDisplayReferences: 0,
    invalidThumbnailReferences: 0,
    missingStorageRoots: 0,
    fileSizeMismatches: 0,
    otherProblems: 0
  };
}

function incrementCategoryCount(
  summary: AssetIntegritySummary,
  category: AssetIntegrityProblemCategory
): void {
  switch (category) {
    case 'MissingOriginalFile':
      summary.missingOriginals += 1;
      return;
    case 'MissingDisplayFile':
      summary.missingDisplays += 1;
      return;
    case 'MissingThumbnailFile':
      summary.missingThumbnails += 1;
      return;
    case 'InvalidOriginalReference':
      summary.invalidOriginalReferences += 1;
      return;
    case 'InvalidDisplayReference':
      summary.invalidDisplayReferences += 1;
      return;
    case 'InvalidThumbnailReference':
      summary.invalidThumbnailReferences += 1;
      return;
    case 'MissingStorageRoot':
      summary.missingStorageRoots += 1;
      return;
    case 'FileSizeMismatch':
      summary.fileSizeMismatches += 1;
      return;
    case 'Other':
      summary.otherProblems += 1;
      return;
    default: {
      const _unreachable: never = category;
      throw new Error(`Unhandled integrity category: ${String(_unreachable)}`);
    }
  }
}

function addProblem(
  summary: AssetIntegritySummary,
  problems: AssetIntegrityProblem[],
  asset: MediaAsset,
  category: AssetIntegrityProblemCategory,
  message: string
): void {
  incrementCategoryCount(summary, category);
  problems.push({
    assetId: asset.id,
    filename: asset.filename,
    category,
    message
  });
}

async function statFile(absolutePath: string): Promise<Stats | null> {
  try {
    const stat = await fs.stat(absolutePath);
    if (!stat.isFile()) {
      return null;
    }
    return stat;
  } catch {
    return null;
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeFormat(value: string): string {
  return value.trim().toLowerCase();
}

async function verifyOriginalReference(
  asset: MediaAsset,
  summary: AssetIntegritySummary,
  problems: AssetIntegrityProblem[]
): Promise<void> {
  if (!isNonEmptyString(asset.originalStorageRootId)) {
    addProblem(summary, problems, asset, 'InvalidOriginalReference', 'originalStorageRootId is missing');
    return;
  }

  if (!isNonEmptyString(asset.originalArchivePath)) {
    addProblem(summary, problems, asset, 'InvalidOriginalReference', 'originalArchivePath is missing');
    return;
  }

  if (!isNonEmptyString(asset.originalContentHash)) {
    addProblem(summary, problems, asset, 'InvalidOriginalReference', 'originalContentHash is missing');
  }

  if (!isNonEmptyString(asset.originalFileFormat)) {
    addProblem(summary, problems, asset, 'InvalidOriginalReference', 'originalFileFormat is missing');
  }

  const storageRoot = getStorageRootById(asset.originalStorageRootId);
  if (!storageRoot) {
    addProblem(
      summary,
      problems,
      asset,
      'MissingStorageRoot',
      `originalStorageRootId "${asset.originalStorageRootId}" is not configured`
    );
    return;
  }

  let originalAbsolutePath: string;
  try {
    originalAbsolutePath = resolveSafeAbsolutePath(storageRoot, asset.originalArchivePath);
  } catch (error) {
    addProblem(
      summary,
      problems,
      asset,
      'InvalidOriginalReference',
      `original path is invalid: ${(error as Error).message}`
    );
    return;
  }

  const originalStat = await statFile(originalAbsolutePath);
  if (!originalStat) {
    addProblem(
      summary,
      problems,
      asset,
      'MissingOriginalFile',
      `original file not found: ${asset.originalArchivePath}`
    );
    return;
  }

  if (typeof asset.originalFileSizeBytes === 'number' && asset.originalFileSizeBytes >= 0) {
    if (originalStat.size !== asset.originalFileSizeBytes) {
      addProblem(
        summary,
        problems,
        asset,
        'FileSizeMismatch',
        `original size mismatch: db=${asset.originalFileSizeBytes} disk=${originalStat.size}`
      );
    }
  }
}

async function verifyDisplayReference(
  asset: MediaAsset,
  summary: AssetIntegritySummary,
  problems: AssetIntegrityProblem[]
): Promise<void> {
  if (!isNonEmptyString(asset.displayFileFormat)) {
    addProblem(summary, problems, asset, 'InvalidDisplayReference', 'displayFileFormat is missing');
  }

  const originalFormat = normalizeFormat(asset.originalFileFormat ?? '');
  const displayFormat = normalizeFormat(asset.displayFileFormat ?? '');

  if (asset.displayStorageType === 'archive-root') {
    if (!isNonEmptyString(asset.displayStorageRootId) || !isNonEmptyString(asset.displayArchivePath)) {
      addProblem(
        summary,
        problems,
        asset,
        'InvalidDisplayReference',
        'archive-root display is missing displayStorageRootId or displayArchivePath'
      );
      return;
    }

    if (isNonEmptyString(asset.displayDerivedPath)) {
      addProblem(
        summary,
        problems,
        asset,
        'InvalidDisplayReference',
        'archive-root display should not include displayDerivedPath'
      );
    }

    const storageRoot = getStorageRootById(asset.displayStorageRootId);
    if (!storageRoot) {
      addProblem(
        summary,
        problems,
        asset,
        'MissingStorageRoot',
        `displayStorageRootId "${asset.displayStorageRootId}" is not configured`
      );
      return;
    }

    let displayAbsolutePath: string;
    try {
      displayAbsolutePath = resolveSafeAbsolutePath(storageRoot, asset.displayArchivePath);
    } catch (error) {
      addProblem(
        summary,
        problems,
        asset,
        'InvalidDisplayReference',
        `display archive path is invalid: ${(error as Error).message}`
      );
      return;
    }

    const displayStat = await statFile(displayAbsolutePath);
    if (!displayStat) {
      addProblem(
        summary,
        problems,
        asset,
        'MissingDisplayFile',
        `display file not found: ${asset.displayArchivePath}`
      );
    }
  } else if (asset.displayStorageType === 'derived-root') {
    if (!isNonEmptyString(asset.displayDerivedPath)) {
      addProblem(
        summary,
        problems,
        asset,
        'InvalidDisplayReference',
        'derived-root display is missing displayDerivedPath'
      );
      return;
    }

    if (isNonEmptyString(asset.displayStorageRootId) || isNonEmptyString(asset.displayArchivePath)) {
      addProblem(
        summary,
        problems,
        asset,
        'InvalidDisplayReference',
        'derived-root display should not include archive-root display fields'
      );
    }

    if (!asset.displayDerivedPath.startsWith('display-jpegs/')) {
      addProblem(
        summary,
        problems,
        asset,
        'InvalidDisplayReference',
        `displayDerivedPath should use display-jpegs/ prefix: ${asset.displayDerivedPath}`
      );
    }

    let displayAbsolutePath: string;
    try {
      displayAbsolutePath = resolveDerivedAbsolutePath(asset.displayDerivedPath);
    } catch (error) {
      addProblem(
        summary,
        problems,
        asset,
        'InvalidDisplayReference',
        `display derived path is invalid: ${(error as Error).message}`
      );
      return;
    }

    const displayStat = await statFile(displayAbsolutePath);
    if (!displayStat) {
      addProblem(
        summary,
        problems,
        asset,
        'MissingDisplayFile',
        `display derived file not found: ${asset.displayDerivedPath}`
      );
    }
  } else {
    addProblem(
      summary,
      problems,
      asset,
      'InvalidDisplayReference',
      `displayStorageType "${String(asset.displayStorageType)}" is invalid`
    );
    return;
  }

  if (originalFormat === 'heic') {
    if (asset.displayStorageType !== 'derived-root') {
      addProblem(
        summary,
        problems,
        asset,
        'InvalidDisplayReference',
        'HEIC source assets are expected to use derived-root display files'
      );
    }
    if (displayFormat !== 'jpg' && displayFormat !== 'jpeg') {
      addProblem(
        summary,
        problems,
        asset,
        'InvalidDisplayReference',
        `HEIC source assets are expected to use JPG display format, found "${asset.displayFileFormat}"`
      );
    }
  }
}

async function verifyThumbnailReference(
  asset: MediaAsset,
  summary: AssetIntegritySummary,
  problems: AssetIntegrityProblem[]
): Promise<void> {
  const thumbnailRequired = asset.mediaType === MediaType.Photo;

  if (asset.thumbnailStorageType !== 'derived-root') {
    if (thumbnailRequired) {
      addProblem(
        summary,
        problems,
        asset,
        'InvalidThumbnailReference',
        'photo assets must have thumbnailStorageType=derived-root'
      );
    }
    return;
  }

  if (!isNonEmptyString(asset.thumbnailDerivedPath)) {
    addProblem(
      summary,
      problems,
      asset,
      'InvalidThumbnailReference',
      'thumbnailDerivedPath is missing for derived-root thumbnail'
    );
    return;
  }

  if (!asset.thumbnailDerivedPath.startsWith('thumbnails/')) {
    addProblem(
      summary,
      problems,
      asset,
      'InvalidThumbnailReference',
      `thumbnailDerivedPath should use thumbnails/ prefix: ${asset.thumbnailDerivedPath}`
    );
  }

  const thumbnailFormat = normalizeFormat(asset.thumbnailFileFormat ?? '');
  if (thumbnailFormat !== 'jpg' && thumbnailFormat !== 'jpeg') {
    addProblem(
      summary,
      problems,
      asset,
      'InvalidThumbnailReference',
      `thumbnailFileFormat should be jpg/jpeg, found "${asset.thumbnailFileFormat ?? ''}"`
    );
  }

  let thumbnailAbsolutePath: string;
  try {
    thumbnailAbsolutePath = resolveDerivedAbsolutePath(asset.thumbnailDerivedPath);
  } catch (error) {
    addProblem(
      summary,
      problems,
      asset,
      'InvalidThumbnailReference',
      `thumbnail derived path is invalid: ${(error as Error).message}`
    );
    return;
  }

  const thumbnailStat = await statFile(thumbnailAbsolutePath);
  if (!thumbnailStat) {
    if (thumbnailRequired) {
      addProblem(
        summary,
        problems,
        asset,
        'MissingThumbnailFile',
        `thumbnail file not found: ${asset.thumbnailDerivedPath}`
      );
    } else {
      addProblem(
        summary,
        problems,
        asset,
        'Other',
        `thumbnail file is referenced but missing for non-photo asset: ${asset.thumbnailDerivedPath}`
      );
    }
  }
}

async function verifyAssetIntegrity(): Promise<AssetIntegrityVerificationResult> {
  const summary = createEmptySummary();
  const problems: AssetIntegrityProblem[] = [];

  const assets = await getAllAssets();
  for (const asset of assets) {
    summary.assetsChecked += 1;
    const problemCountBefore = problems.length;

    try {
      await verifyOriginalReference(asset, summary, problems);
      await verifyDisplayReference(asset, summary, problems);
      await verifyThumbnailReference(asset, summary, problems);
    } catch (error) {
      addProblem(
        summary,
        problems,
        asset,
        'Other',
        `unexpected verification error: ${(error as Error).message}`
      );
    }

    if (problems.length === problemCountBefore) {
      summary.assetsWithNoProblems += 1;
    } else {
      summary.assetsWithProblems += 1;
    }
  }

  return {
    summary,
    problems
  };
}

function printHumanReadableResult(result: AssetIntegrityVerificationResult): void {
  const { summary, problems } = result;
  log.info('Asset integrity verification summary');
  log.info(`  assetsChecked=${summary.assetsChecked}`);
  log.info(`  assetsWithNoProblems=${summary.assetsWithNoProblems}`);
  log.info(`  assetsWithProblems=${summary.assetsWithProblems}`);
  log.info(`  missingOriginals=${summary.missingOriginals}`);
  log.info(`  missingDisplays=${summary.missingDisplays}`);
  log.info(`  missingThumbnails=${summary.missingThumbnails}`);
  log.info(`  invalidOriginalReferences=${summary.invalidOriginalReferences}`);
  log.info(`  invalidDisplayReferences=${summary.invalidDisplayReferences}`);
  log.info(`  invalidThumbnailReferences=${summary.invalidThumbnailReferences}`);
  log.info(`  missingStorageRoots=${summary.missingStorageRoots}`);
  log.info(`  fileSizeMismatches=${summary.fileSizeMismatches}`);
  log.info(`  otherProblems=${summary.otherProblems}`);

  if (problems.length === 0) {
    log.info('No integrity problems found.');
    return;
  }

  const sample = problems.slice(0, maxProblemSamples);
  log.warn(`Showing ${sample.length} integrity problems (of ${problems.length})`);
  for (const problem of sample) {
    log.warn(
      `  ${problem.assetId} | ${problem.filename} | ${problem.category} | ${problem.message}`
    );
  }

  if (problems.length > sample.length) {
    log.warn(`  ... ${problems.length - sample.length} additional problems not shown`);
  }
}

async function run(): Promise<void> {
  const jsonOutput = parseJsonOutputFlag(process.argv.slice(2));
  log.info('Starting asset integrity verification');
  log.info(
    'Thumbnail expectation: photo assets must have valid thumbnails; non-photo assets may omit thumbnails in v1'
  );

  await connectToMongo();

  try {
    const result = await verifyAssetIntegrity();
    if (jsonOutput) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      printHumanReadableResult(result);
    }

    if (result.summary.assetsWithProblems > 0) {
      process.exitCode = 1;
    }
  } finally {
    await mongoose.disconnect();
    log.info('Disconnected from MongoDB');
  }
}

void run();
