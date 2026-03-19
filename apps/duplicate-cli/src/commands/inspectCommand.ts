import { type MediaAsset } from '@tedography/domain';
import {
  DUPLICATE_CANDIDATE_GENERATION_VERSION_V1,
  IMAGE_ANALYSIS_VERSION_V1
} from '@tedography/duplicate-domain';
import mongoose from 'mongoose';
import path from 'node:path';
import {
  getDerivedJpegReferences,
  type MediaAssetDocument,
  parseStorageRoots,
  requireEnv,
  resolveAssetSourcePath
} from '../support/assetSource.js';

interface ImageAnalysisCollectionRecord {
  assetId: string;
  analysisVersion: string;
  width?: number;
  height?: number;
  dHash?: string;
  pHash?: string;
  analysisSourceType?: 'original' | 'derived-jpeg';
  analysisSourcePath?: string;
  decodeStrategy?: string;
  normalizedFingerprintStatus: 'pending' | 'ready' | 'failed';
  errorMessage?: string;
  computedAt: Date;
  sourceUpdatedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

interface DuplicateCandidatePairCollectionRecord {
  assetIdA: string;
  assetIdB: string;
  score: number;
  classification: 'very_likely_duplicate' | 'possible_duplicate' | 'similar_image';
  status: 'unreviewed' | 'ignored' | 'reviewed';
}

export interface InspectCommandOptions {
  assetId?: string;
  path?: string;
}

function formatValue(value: string | number | undefined | null): string {
  if (value === undefined || value === null || value === '') {
    return 'n/a';
  }

  return String(value);
}

function formatDate(value: Date | string | undefined | null): string {
  if (!value) {
    return 'n/a';
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? 'n/a' : date.toISOString();
}

function getAssetArchivePath(asset: MediaAsset): string | undefined {
  if (typeof asset.originalArchivePath === 'string' && asset.originalArchivePath.length > 0) {
    return asset.originalArchivePath;
  }

  if (typeof asset.archivePath === 'string' && asset.archivePath.length > 0) {
    return asset.archivePath;
  }

  return undefined;
}

async function findMediaAssetByPath(
  mediaAssetsCollection: mongoose.mongo.Collection<MediaAssetDocument>,
  requestedPath: string
): Promise<MediaAssetDocument | null> {
  const normalizedRequestedPath = path.normalize(requestedPath);
  const exactArchiveMatch = await mediaAssetsCollection.findOne(
    {
      $or: [{ originalArchivePath: normalizedRequestedPath }, { archivePath: normalizedRequestedPath }]
    },
    { projection: { _id: 0 } }
  );

  if (exactArchiveMatch) {
    return exactArchiveMatch;
  }

  if (!path.isAbsolute(requestedPath)) {
    return null;
  }

  const storageRoots = parseStorageRoots(process.env.TEDOGRAPHY_STORAGE_ROOTS);
  if (storageRoots.length === 0) {
    throw new Error(
      'Inspect by absolute path requires TEDOGRAPHY_STORAGE_ROOTS so asset source paths can be resolved.'
    );
  }

  const normalizedAbsolutePath = path.resolve(requestedPath);
  const candidates = await mediaAssetsCollection.find({}, { projection: { _id: 0 } }).toArray();

  for (const candidate of candidates) {
    try {
      if (resolveAssetSourcePath(candidate, storageRoots) === normalizedAbsolutePath) {
        return candidate;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function printImageAnalysis(
  asset: MediaAssetDocument,
  analysis: ImageAnalysisCollectionRecord,
  resolvedSourcePath: string | null,
  derivedJpegReferences: Awaited<ReturnType<typeof getDerivedJpegReferences>>,
  candidatePairCount: number,
  candidatePairs: DuplicateCandidatePairCollectionRecord[]
): void {
  console.log('Image Analysis');
  console.log('--------------');
  console.log(`Asset ID: ${asset.id}`);
  console.log(`Analysis Version: ${analysis.analysisVersion}`);
  console.log(`Status: ${analysis.normalizedFingerprintStatus}`);
  console.log(`Dimensions: ${formatValue(analysis.width)} x ${formatValue(analysis.height)}`);
  console.log(`dHash: ${formatValue(analysis.dHash)}`);
  console.log(`pHash: ${formatValue(analysis.pHash)}`);
  console.log(`Analysis Source Type: ${formatValue(analysis.analysisSourceType)}`);
  console.log(`Analysis Source Path: ${formatValue(analysis.analysisSourcePath)}`);
  console.log(`Decode Strategy: ${formatValue(analysis.decodeStrategy)}`);
  console.log(`Computed At: ${formatDate(analysis.computedAt)}`);
  console.log(`Created At: ${formatDate(analysis.createdAt)}`);
  console.log(`Updated At: ${formatDate(analysis.updatedAt)}`);
  console.log(`Source Updated At: ${formatDate(analysis.sourceUpdatedAt)}`);

  if (analysis.errorMessage) {
    console.log(`Error Message: ${analysis.errorMessage}`);
  }

  console.log('');
  console.log('Media Asset');
  console.log('-----------');
  console.log(`Filename: ${formatValue(asset.filename)}`);
  console.log(`Archive Path: ${formatValue(getAssetArchivePath(asset))}`);
  console.log(`Resolved Source Path: ${formatValue(resolvedSourcePath)}`);
  console.log(`Media Type: ${formatValue(asset.mediaType)}`);
  console.log(`Original File Format: ${formatValue(asset.originalFileFormat)}`);

  console.log('');
  console.log('Derived JPEGs');
  console.log('-------------');
  if (derivedJpegReferences.length === 0) {
    console.log('No derived JPEG references found.');
    return;
  }

  for (const reference of derivedJpegReferences) {
    console.log(
      `${reference.kind}: ${reference.exists ? 'present' : 'missing'} (${reference.absolutePath})`
    );
  }

  console.log('');
  console.log('Candidate Pairs');
  console.log('---------------');
  console.log(`Count: ${String(candidatePairCount)}`);
  for (const candidatePair of candidatePairs.slice(0, 3)) {
    const otherAssetId = candidatePair.assetIdA === asset.id ? candidatePair.assetIdB : candidatePair.assetIdA;
    console.log(
      `${otherAssetId} | ${candidatePair.classification} | score=${candidatePair.score.toFixed(4)} | status=${candidatePair.status}`
    );
  }
}

export async function runInspectCommand(options: InspectCommandOptions): Promise<void> {
  const assetId = options.assetId?.trim();
  const requestedPath = options.path?.trim();

  if ((assetId ? 1 : 0) + (requestedPath ? 1 : 0) !== 1) {
    throw new Error('inspect requires exactly one of --asset-id <id> or --path <path>');
  }

  const mongoUri = requireEnv('MONGODB_URI');
  const analysisVersion = IMAGE_ANALYSIS_VERSION_V1;
  const client = new mongoose.mongo.MongoClient(mongoUri);

  try {
    await client.connect();
    const database = client.db();
    const mediaAssetsCollection = database.collection<MediaAssetDocument>('mediaAssets');
    const imageAnalysesCollection = database.collection<ImageAnalysisCollectionRecord>('imageAnalyses');
    const duplicateCandidatePairsCollection =
      database.collection<DuplicateCandidatePairCollectionRecord>('duplicateCandidatePairs');

    const asset = assetId
      ? await mediaAssetsCollection.findOne({ id: assetId }, { projection: { _id: 0 } })
      : await findMediaAssetByPath(mediaAssetsCollection, requestedPath ?? '');

    if (!asset) {
      throw new Error(
        assetId
          ? `No media asset found for asset id: ${assetId}`
          : `No media asset found for path: ${requestedPath ?? ''}`
      );
    }

    const analysis = await imageAnalysesCollection.findOne(
      { assetId: asset.id, analysisVersion },
      { projection: { _id: 0 } }
    );

    if (!analysis) {
      throw new Error(
        `No image analysis found for asset ${asset.id} at analysis version ${analysisVersion}`
      );
    }

    let resolvedSourcePath: string | null = null;
    const storageRoots = parseStorageRoots(process.env.TEDOGRAPHY_STORAGE_ROOTS);
    const derivedRoot = process.env.TEDOGRAPHY_DERIVED_ROOT?.trim();
    if (storageRoots.length > 0) {
      try {
        resolvedSourcePath = resolveAssetSourcePath(asset, storageRoots);
      } catch {
        resolvedSourcePath = null;
      }
    }

    const derivedJpegReferences = await getDerivedJpegReferences(asset, derivedRoot);
    const candidatePairCount = await duplicateCandidatePairsCollection.countDocuments({
      generationVersion: DUPLICATE_CANDIDATE_GENERATION_VERSION_V1,
      $or: [{ assetIdA: asset.id }, { assetIdB: asset.id }]
    });
    const candidatePairs = await duplicateCandidatePairsCollection
      .find(
        {
          generationVersion: DUPLICATE_CANDIDATE_GENERATION_VERSION_V1,
          $or: [{ assetIdA: asset.id }, { assetIdB: asset.id }]
        },
        { projection: { _id: 0 } }
      )
      .sort({ score: -1 })
      .limit(3)
      .toArray();

    printImageAnalysis(
      asset,
      analysis,
      resolvedSourcePath,
      derivedJpegReferences,
      candidatePairCount,
      candidatePairs
    );
  } finally {
    await client.close();
  }
}
