#!/usr/bin/env tsx

/**
 * Count mediaAssets whose captureDateTime is missing and whose matching
 * Google Takeout sidecar contains photoTakenTime.
 *
 * Run from the repo root, for example:
 *
 *   pnpm --filter @tedography/api exec tsx src/tools/countUnknownCaptureAssetsWithPhotoTakenTime.ts
 *
 * Optional flags:
 *   --runs-root /Volumes/ShMedia/PHOTO_ARCHIVE/RUNS
 *   --sample-limit 20
 *   --verbose
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PhotoState } from '@tedography/domain';
import mongoose from 'mongoose';
import { extractMetadata, shutdownMetadataExtractor } from '@tedography/media-metadata';
import { connectToMongo } from '../db.js';
import { DuplicateGroupResolutionModel } from '../models/duplicateGroupResolutionModel.js';
import { MediaAssetModel } from '../models/mediaAssetModel.js';

const DEFAULT_RUNS_ROOT = '/Volumes/ShMedia/PHOTO_ARCHIVE/RUNS';
const DEFAULT_MULTIPLE_MATCHES_OUTPUT = fileURLToPath(
  new URL('../../../scripts/output/countUnknownCaptureAssetsWithPhotoTakenTime__multiple_matches.json', import.meta.url)
);
const DEFAULT_SAFE_CANDIDATES_OUTPUT = fileURLToPath(
  new URL('../../../scripts/output/countUnknownCaptureAssetsWithPhotoTakenTime__safe_candidates.json', import.meta.url)
);
const UNKNOWN_CAPTURE_PHOTO_TAKEN_TIMESTAMP = '-63104400';
const UNKNOWN_CAPTURE_PHOTO_TAKEN_FORMATTED = 'Jan 1, 1968, 3:00:00 PM UTC';

const MEDIA_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.heic',
  '.heif',
  '.webp',
  '.gif',
  '.tif',
  '.tiff',
  '.bmp',
  '.dng',
  '.mp4',
  '.mov',
  '.avi',
  '.m4v',
  '.3gp',
  '.mts',
  '.m2ts',
  '.webm'
] as const;

type ParsedArgs = {
  runsRoot: string;
  sampleLimit: number;
  verbose: boolean;
  multipleMatchesOutput: string;
  safeCandidatesOutput: string;
  apply: boolean;
};

type SidecarInfo = {
  path: string;
  mediaPath: string | null;
  mediaWidth: number | null;
  mediaHeight: number | null;
  hasPhotoTakenTime: boolean;
  hasStructuredPhotoTakenTime: boolean;
  hasExactUnknownCapturePhotoTakenTime: boolean;
  photoTakenTime?: unknown;
};

type SidecarIndex = {
  byBaseName: Map<string, SidecarInfo[]>;
  stats: {
    matchedSidecarCount: number;
    unreadableJsonCount: number;
    withPhotoTakenTimeCount: number;
    withoutPhotoTakenTimeCount: number;
    withExactUnknownCapturePhotoTakenTimeCount: number;
    matchedMediaFileCount: number;
    missingMediaFileCount: number;
    unreadableMediaMetadataCount: number;
  };
};

type MediaAssetDoc = {
  _id: unknown;
  id?: string;
  filename?: string;
  originalArchivePath?: string;
  captureDateTime?: string | null;
  width?: number | null;
  height?: number | null;
  photoState?: string | null;
};

type MultipleMatchedSidecarRecord = {
  asset: string;
  assetId?: string;
  isPossibleUnconfirmedDuplicate: boolean;
  candidateSidecars: string[];
  verifiedMatchedSidecarCount: number;
  matchedSidecars: Array<{
    path: string;
    mediaPath: string | null;
    mediaWidth: number | null;
    mediaHeight: number | null;
    hasPhotoTakenTime: boolean;
    hasStructuredPhotoTakenTime: boolean;
    photoTakenTime?: unknown;
  }>;
};

type SafeMetadataUpdateCandidate = {
  assetId: string;
  asset: string;
  filename?: string;
  originalArchivePath?: string;
  basenameMatchedSidecarCount: number;
  verifiedMatchCount: number;
  sidecarPath: string;
  mediaPath: string | null;
  mediaWidth: number | null;
  mediaHeight: number | null;
  photoTakenTime: {
    timestamp: string;
    formatted: string;
  };
  captureDateTimeIso: string;
};

function parseArgs(argv: string[]): ParsedArgs {
  const args: ParsedArgs = {
    runsRoot: DEFAULT_RUNS_ROOT,
    sampleLimit: 20,
    verbose: false,
    multipleMatchesOutput: DEFAULT_MULTIPLE_MATCHES_OUTPUT,
    safeCandidatesOutput: DEFAULT_SAFE_CANDIDATES_OUTPUT,
    apply: false
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--runs-root') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Missing value for --runs-root');
      }
      args.runsRoot = value;
      index += 1;
      continue;
    }

    if (arg === '--sample-limit') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Missing value for --sample-limit');
      }
      args.sampleLimit = Number(value);
      index += 1;
      continue;
    }

    if (arg === '--verbose') {
      args.verbose = true;
      continue;
    }

    if (arg === '--multiple-matches-output') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Missing value for --multiple-matches-output');
      }
      args.multipleMatchesOutput = value;
      index += 1;
      continue;
    }

    if (arg === '--safe-candidates-output') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Missing value for --safe-candidates-output');
      }
      args.safeCandidatesOutput = value;
      index += 1;
      continue;
    }

    if (arg === '--apply') {
      args.apply = true;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      printHelpAndExit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!Number.isFinite(args.sampleLimit) || args.sampleLimit < 0) {
    throw new Error(`Invalid --sample-limit: ${args.sampleLimit}`);
  }

  return args;
}

function printHelpAndExit(code: number): never {
  console.log(`
Usage:
  pnpm --filter @tedography/api exec tsx src/tools/countUnknownCaptureAssetsWithPhotoTakenTime.ts

Options:
  --runs-root <path>    Default: ${DEFAULT_RUNS_ROOT}
  --sample-limit <n>    Default: 20
  --multiple-matches-output <path>
                        Default: ${DEFAULT_MULTIPLE_MATCHES_OUTPUT}
  --safe-candidates-output <path>
                        Default: ${DEFAULT_SAFE_CANDIDATES_OUTPUT}
  --apply               Write safe-candidate captureDateTime values into MongoDB
  --verbose             Print sample matches
  --help, -h
`);
  process.exit(code);
}

function isTakeoutSidecarFilename(filename: string): boolean {
  const lower = filename.toLowerCase();

  if (lower.startsWith('._')) {
    return false;
  }

  if (lower.endsWith('.supplemental-metadata.json')) {
    return true;
  }

  return MEDIA_EXTENSIONS.some((extension) => lower.endsWith(`${extension}.json`));
}

function hasStructuredPhotoTakenTimeValue(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const timestamp = (value as { timestamp?: unknown }).timestamp;
  const formatted = (value as { formatted?: unknown }).formatted;

  return (
    typeof timestamp === 'string' &&
    timestamp.length > 0 &&
    typeof formatted === 'string' &&
    formatted.length > 0
  );
}

function hasExactUnknownCapturePhotoTakenTimeValue(value: unknown): boolean {
  if (!hasStructuredPhotoTakenTimeValue(value)) {
    return false;
  }

  const timestamp = (value as { timestamp: string }).timestamp;
  const formatted = (value as { formatted: string }).formatted;

  return (
    timestamp === UNKNOWN_CAPTURE_PHOTO_TAKEN_TIMESTAMP &&
    formatted === UNKNOWN_CAPTURE_PHOTO_TAKEN_FORMATTED
  );
}

function walk(dirPath: string, visitor: (fullPath: string) => void): void {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      walk(fullPath, visitor);
      continue;
    }

    if (entry.isFile()) {
      visitor(fullPath);
    }
  }
}

function getSidecarMediaPath(sidecarPath: string): string | null {
  const lower = sidecarPath.toLowerCase();

  if (lower.endsWith('.supplemental-metadata.json')) {
    const candidate = sidecarPath.slice(0, -'.supplemental-metadata.json'.length);
    return fs.existsSync(candidate) ? candidate : null;
  }

  if (lower.endsWith('.json')) {
    const candidate = sidecarPath.slice(0, -'.json'.length);
    return fs.existsSync(candidate) ? candidate : null;
  }

  return null;
}

function dimensionsMatchAsset(
  asset: Pick<MediaAssetDoc, 'width' | 'height'>,
  sidecar: Pick<SidecarInfo, 'mediaWidth' | 'mediaHeight'>
): boolean {
  return (
    typeof asset.width === 'number' &&
    typeof asset.height === 'number' &&
    typeof sidecar.mediaWidth === 'number' &&
    typeof sidecar.mediaHeight === 'number' &&
    asset.width === sidecar.mediaWidth &&
    asset.height === sidecar.mediaHeight
  );
}

async function buildSidecarIndex(runsRoot: string): Promise<SidecarIndex> {
  const byBaseName = new Map<string, SidecarInfo[]>();

  let matchedSidecarCount = 0;
  let unreadableJsonCount = 0;
  let withPhotoTakenTimeCount = 0;
  let withoutPhotoTakenTimeCount = 0;
  let withExactUnknownCapturePhotoTakenTimeCount = 0;
  let matchedMediaFileCount = 0;
  let missingMediaFileCount = 0;
  let unreadableMediaMetadataCount = 0;
  const sidecarPaths: string[] = [];
  walk(runsRoot, (fullPath) => {
    const baseName = path.basename(fullPath);
    const normalizedBaseName = baseName.toLocaleLowerCase();

    if (!isTakeoutSidecarFilename(baseName)) {
      return;
    }

    sidecarPaths.push(fullPath);
  });

  for (const fullPath of sidecarPaths) {
    const baseName = path.basename(fullPath);
    const normalizedBaseName = baseName.toLocaleLowerCase();

    matchedSidecarCount += 1;

    let parsed: unknown;
    try {
      parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8')) as unknown;
    } catch {
      unreadableJsonCount += 1;
      continue;
    }

    const hasPhotoTakenTime =
      parsed !== null &&
      typeof parsed === 'object' &&
      Object.prototype.hasOwnProperty.call(parsed, 'photoTakenTime');
    const photoTakenTime = hasPhotoTakenTime ? (parsed as Record<string, unknown>).photoTakenTime : undefined;
    const hasStructuredPhotoTakenTime = hasStructuredPhotoTakenTimeValue(photoTakenTime);
    const hasExactUnknownCapturePhotoTakenTime =
      hasExactUnknownCapturePhotoTakenTimeValue(photoTakenTime);

    if (hasStructuredPhotoTakenTime) {
      withPhotoTakenTimeCount += 1;
    } else {
      withoutPhotoTakenTimeCount += 1;
    }

    if (hasExactUnknownCapturePhotoTakenTime) {
      withExactUnknownCapturePhotoTakenTimeCount += 1;
    }

    const mediaPath = getSidecarMediaPath(fullPath);
    let mediaWidth: number | null = null;
    let mediaHeight: number | null = null;
    if (mediaPath) {
      matchedMediaFileCount += 1;
      const metadata = await extractMetadata(mediaPath);
      if (typeof metadata.width === 'number') {
        mediaWidth = metadata.width;
      }
      if (typeof metadata.height === 'number') {
        mediaHeight = metadata.height;
      }
      if (mediaWidth === null || mediaHeight === null) {
        unreadableMediaMetadataCount += 1;
      }
    } else {
      missingMediaFileCount += 1;
    }

    const sidecars = byBaseName.get(normalizedBaseName) ?? [];
    sidecars.push({
      path: fullPath,
      mediaPath,
      mediaWidth,
      mediaHeight,
      hasPhotoTakenTime,
      hasStructuredPhotoTakenTime,
      hasExactUnknownCapturePhotoTakenTime,
      photoTakenTime
    });
    byBaseName.set(normalizedBaseName, sidecars);
  }

  return {
    byBaseName,
    stats: {
      matchedSidecarCount,
      unreadableJsonCount,
      withPhotoTakenTimeCount,
      withoutPhotoTakenTimeCount,
      withExactUnknownCapturePhotoTakenTimeCount,
      matchedMediaFileCount,
      missingMediaFileCount,
      unreadableMediaMetadataCount
    }
  };
}

function getCandidateSidecarBaseNames(doc: MediaAssetDoc): string[] {
  const baseNames = new Set<string>();
  const filenameCandidates = [
    doc.filename,
    doc.originalArchivePath ? path.basename(doc.originalArchivePath) : undefined
  ].filter((value): value is string => typeof value === 'string' && value.length > 0);

  for (const fileName of filenameCandidates) {
    baseNames.add(`${fileName}.supplemental-metadata.json`.toLocaleLowerCase());
    baseNames.add(`${fileName}.json`.toLocaleLowerCase());
  }

  return Array.from(baseNames);
}

function getAssetLabel(doc: MediaAssetDoc): string {
  return doc.originalArchivePath || doc.filename || doc.id || String(doc._id);
}

function parseStructuredPhotoTakenTime(
  value: unknown
): { timestamp: string; formatted: string } | null {
  if (!hasStructuredPhotoTakenTimeValue(value)) {
    return null;
  }

  const timestamp = (value as { timestamp: string }).timestamp;
  const formatted = (value as { formatted: string }).formatted;
  return { timestamp, formatted };
}

function toCaptureDateTimeIso(photoTakenTime: { timestamp: string; formatted: string }): string | null {
  const timestampSeconds = Number(photoTakenTime.timestamp);
  if (!Number.isFinite(timestampSeconds)) {
    return null;
  }

  return new Date(timestampSeconds * 1000).toISOString();
}

function getConfirmedSuppressedDuplicateAssetIds(
  resolutions: Array<{
    assetIds: string[];
    proposedCanonicalAssetId: string;
    manualCanonicalAssetId?: string | null;
  }>
): Set<string> {
  const suppressedAssetIds = new Set<string>();

  for (const resolution of resolutions) {
    const selectedCanonicalAssetId =
      resolution.manualCanonicalAssetId &&
      resolution.assetIds.includes(resolution.manualCanonicalAssetId)
        ? resolution.manualCanonicalAssetId
        : resolution.proposedCanonicalAssetId;

    for (const assetId of resolution.assetIds) {
      if (assetId !== selectedCanonicalAssetId) {
        suppressedAssetIds.add(assetId);
      }
    }
  }

  return suppressedAssetIds;
}

function getAssetIdsInDuplicateGroups(
  resolutions: Array<{
    assetIds: string[];
  }>
): Set<string> {
  const assetIds = new Set<string>();

  for (const resolution of resolutions) {
    for (const assetId of resolution.assetIds) {
      assetIds.add(assetId);
    }
  }

  return assetIds;
}

function writeMultipleMatchesOutput(
  outputPath: string,
  records: MultipleMatchedSidecarRecord[]
): void {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(
    outputPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        recordCount: records.length,
        records
      },
      null,
      2
    )}\n`,
    'utf8'
  );
}

function writeSafeCandidatesOutput(
  outputPath: string,
  candidates: SafeMetadataUpdateCandidate[]
): void {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(
    outputPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        candidateCount: candidates.length,
        candidates
      },
      null,
      2
    )}\n`,
    'utf8'
  );
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  if (!fs.existsSync(args.runsRoot)) {
    throw new Error(`Runs root does not exist: ${args.runsRoot}`);
  }

  console.log(`Scanning Takeout sidecars under: ${args.runsRoot}`);
  const sidecarIndex = await buildSidecarIndex(args.runsRoot);

  console.log('');
  console.log('Sidecar scan summary:');
  console.log(
    `  matched sidecar JSON files:                         ${sidecarIndex.stats.matchedSidecarCount}`
  );
  console.log(
    `  readable matched sidecars WITH photoTakenTime:     ${sidecarIndex.stats.withPhotoTakenTimeCount}`
  );
  console.log(
    `  readable matched sidecars WITH exact unknown value:${sidecarIndex.stats.withExactUnknownCapturePhotoTakenTimeCount}`
  );
  console.log(
    `  readable matched sidecars WITHOUT photoTakenTime:  ${sidecarIndex.stats.withoutPhotoTakenTimeCount}`
  );
  console.log(
    `  matched adjacent media files:                      ${sidecarIndex.stats.matchedMediaFileCount}`
  );
  console.log(
    `  sidecars missing adjacent media file:              ${sidecarIndex.stats.missingMediaFileCount}`
  );
  console.log(
    `  adjacent media files with unreadable dimensions:   ${sidecarIndex.stats.unreadableMediaMetadataCount}`
  );
  console.log(
    `  unreadable matched sidecars:                       ${sidecarIndex.stats.unreadableJsonCount}`
  );

  console.log('');
  console.log('Connecting through Tedography Mongoose...');
  await connectToMongo();

  const confirmedResolutions = (await DuplicateGroupResolutionModel.find(
    { resolutionStatus: 'confirmed' },
    { _id: 0, assetIds: 1, proposedCanonicalAssetId: 1, manualCanonicalAssetId: 1 }
  ).lean()) as Array<{
    assetIds: string[];
    proposedCanonicalAssetId: string;
    manualCanonicalAssetId?: string | null;
  }>;
  const proposedResolutions = (await DuplicateGroupResolutionModel.find(
    { resolutionStatus: 'proposed' },
    { _id: 0, assetIds: 1 }
  ).lean()) as Array<{
    assetIds: string[];
  }>;

  const confirmedSuppressedDuplicateAssetIds = getConfirmedSuppressedDuplicateAssetIds(
    confirmedResolutions
  );
  const confirmedDuplicateAssetIds = getAssetIdsInDuplicateGroups(confirmedResolutions);
  const proposedDuplicateAssetIds = getAssetIdsInDuplicateGroups(proposedResolutions);
  const possibleUnconfirmedDuplicateAssetIds = new Set(
    Array.from(proposedDuplicateAssetIds).filter((assetId) => !confirmedDuplicateAssetIds.has(assetId))
  );

  const docs = (await MediaAssetModel.find(
    {
      $and: [
        {
          $or: [{ captureDateTime: { $exists: false } }, { captureDateTime: null }, { captureDateTime: '' }]
        },
        { photoState: { $ne: PhotoState.Discard } },
        confirmedSuppressedDuplicateAssetIds.size > 0
          ? { id: { $nin: Array.from(confirmedSuppressedDuplicateAssetIds) } }
          : {}
      ]
    },
    {
      _id: 1,
      id: 1,
      filename: 1,
      originalArchivePath: 1,
      captureDateTime: 1,
      width: 1,
      height: 1,
      photoState: 1
    }
  ).lean()) as MediaAssetDoc[];

  let unknownCaptureAssetCount = 0;
  let assetsWithRawMatchedSidecar = 0;
  let assetsWithExactlyOneRawMatchedSidecar = 0;
  let assetsWithMultipleRawMatchedSidecars = 0;
  let assetsWithVerifiedMatchedSidecar = 0;
  let assetsWithExactlyOneVerifiedMatchedSidecar = 0;
  let assetsWithMultipleVerifiedMatchedSidecars = 0;
  let assetsWithVerifiedMatchedSidecarAndPhotoTakenTime = 0;
  let assetsWithVerifiedMatchedSidecarAndExactUnknownCapturePhotoTakenTime = 0;
  let assetsWithVerifiedMatchedSidecarButNoPhotoTakenTime = 0;
  let assetsWithoutVerifiedMatchedSidecar = 0;
  let assetsWithMultipleMatchedSidecars = 0;
  let assetsWithMultipleMatchedSidecarsThatArePossibleUnconfirmedDuplicates = 0;
  let safeMetadataUpdateCandidateCount = 0;
  let appliedSafeMetadataUpdateCount = 0;

  const sampleWithPhotoTakenTime: Array<{
    asset: string;
    matchedSidecars: Array<{ path: string; photoTakenTime?: unknown }>;
  }> = [];
  const sampleWithoutSidecar: Array<{
    asset: string;
    candidateSidecars: string[];
  }> = [];
  const sampleWithSidecarButNoPhotoTakenTime: Array<{
    asset: string;
    matchedSidecars: string[];
  }> = [];
  const multipleMatchedSidecarRecords: MultipleMatchedSidecarRecord[] = [];
  const safeMetadataUpdateCandidates: SafeMetadataUpdateCandidate[] = [];

  for (const doc of docs) {
    unknownCaptureAssetCount += 1;

    const candidateBaseNames = getCandidateSidecarBaseNames(doc);
    const matches: SidecarInfo[] = [];

    for (const baseName of candidateBaseNames) {
      const sidecars = sidecarIndex.byBaseName.get(baseName);
      if (sidecars) {
        matches.push(...sidecars);
      }
    }

    if (matches.length > 0) {
      assetsWithRawMatchedSidecar += 1;
      if (matches.length === 1) {
        assetsWithExactlyOneRawMatchedSidecar += 1;
      } else {
        assetsWithMultipleRawMatchedSidecars += 1;
      }
    }

    const verifiedMatches = matches.filter((match) => dimensionsMatchAsset(doc, match));

    if (verifiedMatches.length === 0) {
      assetsWithoutVerifiedMatchedSidecar += 1;

      if (sampleWithoutSidecar.length < args.sampleLimit) {
        sampleWithoutSidecar.push({
          asset: getAssetLabel(doc),
          candidateSidecars: candidateBaseNames
        });
      }
      continue;
    }

    assetsWithVerifiedMatchedSidecar += 1;
    if (verifiedMatches.length === 1) {
      assetsWithExactlyOneVerifiedMatchedSidecar += 1;
    } else {
      assetsWithMultipleVerifiedMatchedSidecars += 1;
    }

    if (verifiedMatches.length > 1) {
      assetsWithMultipleMatchedSidecars += 1;
      const isPossibleUnconfirmedDuplicate =
        typeof doc.id === 'string' && possibleUnconfirmedDuplicateAssetIds.has(doc.id);
      if (isPossibleUnconfirmedDuplicate) {
        assetsWithMultipleMatchedSidecarsThatArePossibleUnconfirmedDuplicates += 1;
      }
      multipleMatchedSidecarRecords.push({
        asset: getAssetLabel(doc),
        ...(doc.id ? { assetId: doc.id } : {}),
        isPossibleUnconfirmedDuplicate,
        candidateSidecars: candidateBaseNames,
        verifiedMatchedSidecarCount: verifiedMatches.length,
        matchedSidecars: matches.map((match) => ({
          path: match.path,
          mediaPath: match.mediaPath,
          mediaWidth: match.mediaWidth,
          mediaHeight: match.mediaHeight,
          hasPhotoTakenTime: match.hasPhotoTakenTime,
          hasStructuredPhotoTakenTime: match.hasStructuredPhotoTakenTime,
          ...(match.hasPhotoTakenTime ? { photoTakenTime: match.photoTakenTime } : {})
        }))
      });
    }

    if (verifiedMatches.some((match) => match.hasStructuredPhotoTakenTime)) {
      assetsWithVerifiedMatchedSidecarAndPhotoTakenTime += 1;

      if (verifiedMatches.some((match) => match.hasExactUnknownCapturePhotoTakenTime)) {
        assetsWithVerifiedMatchedSidecarAndExactUnknownCapturePhotoTakenTime += 1;
      }

      if (sampleWithPhotoTakenTime.length < args.sampleLimit) {
        sampleWithPhotoTakenTime.push({
          asset: getAssetLabel(doc),
          matchedSidecars: verifiedMatches
            .filter((match) => match.hasStructuredPhotoTakenTime)
            .slice(0, 5)
            .map((match) => ({
              path: match.path,
              photoTakenTime: match.photoTakenTime
            }))
        });
      }
    }

    if (
      verifiedMatches.length === 1 &&
      verifiedMatches[0]?.hasStructuredPhotoTakenTime === true &&
      verifiedMatches[0].hasExactUnknownCapturePhotoTakenTime !== true &&
      typeof doc.id === 'string'
    ) {
      const parsedPhotoTakenTime = parseStructuredPhotoTakenTime(verifiedMatches[0].photoTakenTime);
      const captureDateTimeIso = parsedPhotoTakenTime ? toCaptureDateTimeIso(parsedPhotoTakenTime) : null;

      if (parsedPhotoTakenTime && captureDateTimeIso) {
        safeMetadataUpdateCandidateCount += 1;
        safeMetadataUpdateCandidates.push({
          assetId: doc.id,
          asset: getAssetLabel(doc),
          ...(doc.filename ? { filename: doc.filename } : {}),
          ...(doc.originalArchivePath ? { originalArchivePath: doc.originalArchivePath } : {}),
          basenameMatchedSidecarCount: matches.length,
          verifiedMatchCount: verifiedMatches.length,
          sidecarPath: verifiedMatches[0].path,
          mediaPath: verifiedMatches[0].mediaPath,
          mediaWidth: verifiedMatches[0].mediaWidth,
          mediaHeight: verifiedMatches[0].mediaHeight,
          photoTakenTime: parsedPhotoTakenTime,
          captureDateTimeIso
        });
      }
    }

    if (!verifiedMatches.some((match) => match.hasStructuredPhotoTakenTime)) {
      assetsWithVerifiedMatchedSidecarButNoPhotoTakenTime += 1;

      if (sampleWithSidecarButNoPhotoTakenTime.length < args.sampleLimit) {
        sampleWithSidecarButNoPhotoTakenTime.push({
          asset: getAssetLabel(doc),
          matchedSidecars: verifiedMatches.slice(0, 5).map((match) => match.path)
        });
      }
    }
  }

  if (args.apply) {
    for (const candidate of safeMetadataUpdateCandidates) {
      const updated = await MediaAssetModel.updateOne(
        {
          id: candidate.assetId,
          $or: [{ captureDateTime: { $exists: false } }, { captureDateTime: null }, { captureDateTime: '' }]
        },
        {
          $set: {
            captureDateTime: candidate.captureDateTimeIso
          }
        }
      );
      if (updated.modifiedCount > 0) {
        appliedSafeMetadataUpdateCount += 1;
      }
    }
  }

  console.log('');
  console.log('Unknown-capture asset summary:');
  console.log(`  assets with unknown captureDateTime:               ${unknownCaptureAssetCount}`);
  console.log(`  of those, assets with any basename-matched sidecar:${assetsWithRawMatchedSidecar}`);
  console.log(`  of those, exactly one basename-matched sidecar:   ${assetsWithExactlyOneRawMatchedSidecar}`);
  console.log(`  of those, multiple basename-matched sidecars:     ${assetsWithMultipleRawMatchedSidecars}`);
  console.log(`  of those, assets with dimension-verified sidecar: ${assetsWithVerifiedMatchedSidecar}`);
  console.log(`  of those, exactly one verified sidecar:           ${assetsWithExactlyOneVerifiedMatchedSidecar}`);
  console.log(`  of those, multiple verified sidecars:             ${assetsWithMultipleVerifiedMatchedSidecars}`);
  console.log(
    `  of those, verified sidecar has photoTakenTime:    ${assetsWithVerifiedMatchedSidecarAndPhotoTakenTime}`
  );
  console.log(
    `  of those, verified sidecar has exact unknown value:${assetsWithVerifiedMatchedSidecarAndExactUnknownCapturePhotoTakenTime}`
  );
  console.log(
    `  of those, verified sidecar lacks photoTakenTime:  ${assetsWithVerifiedMatchedSidecarButNoPhotoTakenTime}`
  );
  console.log(`  of those, no dimension-verified sidecar found:    ${assetsWithoutVerifiedMatchedSidecar}`);
  console.log(`  assets with multiple matched sidecars:            ${assetsWithMultipleMatchedSidecars}`);
  console.log(
    `  of those, possible but unconfirmed duplicates:    ${assetsWithMultipleMatchedSidecarsThatArePossibleUnconfirmedDuplicates}`
  );
  console.log(`  safe metadata update candidates:                  ${safeMetadataUpdateCandidateCount}`);
  if (args.apply) {
    console.log(`  applied safe metadata updates:                    ${appliedSafeMetadataUpdateCount}`);
  }

  writeMultipleMatchesOutput(args.multipleMatchesOutput, multipleMatchedSidecarRecords);
  console.log(`  multiple-match details written to:                ${args.multipleMatchesOutput}`);
  writeSafeCandidatesOutput(args.safeCandidatesOutput, safeMetadataUpdateCandidates);
  console.log(`  safe-candidate details written to:                ${args.safeCandidatesOutput}`);

  if (args.verbose) {
    console.log('');
    console.log('Sample assets with matched sidecars containing photoTakenTime:');
    for (const sample of sampleWithPhotoTakenTime) {
      console.log(`- ${sample.asset}`);
      for (const match of sample.matchedSidecars) {
        console.log(`    ${match.path} :: ${JSON.stringify(match.photoTakenTime)}`);
      }
    }

    console.log('');
    console.log('Sample assets with no matched sidecar:');
    for (const sample of sampleWithoutSidecar) {
      console.log(`- ${sample.asset}`);
      for (const candidate of sample.candidateSidecars.slice(0, 5)) {
        console.log(`    candidate: ${candidate}`);
      }
    }

    console.log('');
    console.log('Sample assets with matched sidecar but no photoTakenTime:');
    for (const sample of sampleWithSidecarButNoPhotoTakenTime) {
      console.log(`- ${sample.asset}`);
      for (const matchPath of sample.matchedSidecars) {
        console.log(`    ${matchPath}`);
      }
    }
  }

  await mongoose.disconnect();
  await shutdownMetadataExtractor();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
