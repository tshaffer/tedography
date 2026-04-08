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
import mongoose from 'mongoose';
import { extractMetadata, shutdownMetadataExtractor } from '@tedography/media-metadata';
import { connectToMongo } from '../db.js';
import { MediaAssetModel } from '../models/mediaAssetModel.js';

const DEFAULT_RUNS_ROOT = '/Volumes/ShMedia/PHOTO_ARCHIVE/RUNS';
const DEFAULT_MULTIPLE_MATCHES_OUTPUT = fileURLToPath(
  new URL('../../../scripts/output/countUnknownCaptureAssetsWithPhotoTakenTime__multiple_matches.json', import.meta.url)
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
  filename?: string;
  originalArchivePath?: string;
  captureDateTime?: string | null;
  width?: number | null;
  height?: number | null;
};

type MultipleMatchedSidecarRecord = {
  asset: string;
  candidateSidecars: string[];
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

function parseArgs(argv: string[]): ParsedArgs {
  const args: ParsedArgs = {
    runsRoot: DEFAULT_RUNS_ROOT,
    sampleLimit: 20,
    verbose: false,
    multipleMatchesOutput: DEFAULT_MULTIPLE_MATCHES_OUTPUT
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

    if (!isTakeoutSidecarFilename(baseName)) {
      return;
    }

    sidecarPaths.push(fullPath);
  });

  for (const fullPath of sidecarPaths) {
    const baseName = path.basename(fullPath);

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

    const sidecars = byBaseName.get(baseName) ?? [];
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
    byBaseName.set(baseName, sidecars);
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
    baseNames.add(`${fileName}.supplemental-metadata.json`);
    baseNames.add(`${fileName}.json`);
  }

  return Array.from(baseNames);
}

function getAssetLabel(doc: MediaAssetDoc): string {
  return doc.originalArchivePath || doc.filename || String(doc._id);
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

  const docs = (await MediaAssetModel.find(
    {
      $or: [{ captureDateTime: { $exists: false } }, { captureDateTime: null }, { captureDateTime: '' }]
    },
    {
      _id: 1,
      filename: 1,
      originalArchivePath: 1,
      captureDateTime: 1,
      width: 1,
      height: 1
    }
  ).lean()) as MediaAssetDoc[];

  let unknownCaptureAssetCount = 0;
  let assetsWithRawMatchedSidecar = 0;
  let assetsWithVerifiedMatchedSidecar = 0;
  let assetsWithVerifiedMatchedSidecarAndPhotoTakenTime = 0;
  let assetsWithVerifiedMatchedSidecarAndExactUnknownCapturePhotoTakenTime = 0;
  let assetsWithVerifiedMatchedSidecarButNoPhotoTakenTime = 0;
  let assetsWithoutVerifiedMatchedSidecar = 0;
  let assetsWithMultipleMatchedSidecars = 0;

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

    if (matches.length > 1) {
      assetsWithMultipleMatchedSidecars += 1;
      multipleMatchedSidecarRecords.push({
        asset: getAssetLabel(doc),
        candidateSidecars: candidateBaseNames,
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
      continue;
    }

    assetsWithVerifiedMatchedSidecarButNoPhotoTakenTime += 1;

    if (sampleWithSidecarButNoPhotoTakenTime.length < args.sampleLimit) {
      sampleWithSidecarButNoPhotoTakenTime.push({
        asset: getAssetLabel(doc),
        matchedSidecars: verifiedMatches.slice(0, 5).map((match) => match.path)
      });
    }
  }

  console.log('');
  console.log('Unknown-capture asset summary:');
  console.log(`  assets with unknown captureDateTime:               ${unknownCaptureAssetCount}`);
  console.log(`  of those, assets with any basename-matched sidecar:${assetsWithRawMatchedSidecar}`);
  console.log(`  of those, assets with dimension-verified sidecar: ${assetsWithVerifiedMatchedSidecar}`);
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

  writeMultipleMatchesOutput(args.multipleMatchesOutput, multipleMatchedSidecarRecords);
  console.log(`  multiple-match details written to:                ${args.multipleMatchesOutput}`);

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
