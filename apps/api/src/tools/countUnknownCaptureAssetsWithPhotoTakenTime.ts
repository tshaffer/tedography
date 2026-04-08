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
import mongoose from 'mongoose';
import { connectToMongo } from '../db.js';
import { MediaAssetModel } from '../models/mediaAssetModel.js';

const DEFAULT_RUNS_ROOT = '/Volumes/ShMedia/PHOTO_ARCHIVE/RUNS';

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
};

type SidecarInfo = {
  path: string;
  hasPhotoTakenTime: boolean;
  photoTakenTime?: unknown;
};

type SidecarIndex = {
  byBaseName: Map<string, SidecarInfo[]>;
  stats: {
    matchedSidecarCount: number;
    unreadableJsonCount: number;
    withPhotoTakenTimeCount: number;
    withoutPhotoTakenTimeCount: number;
  };
};

type MediaAssetDoc = {
  _id: unknown;
  filename?: string;
  originalArchivePath?: string;
  captureDateTime?: string | null;
};

function parseArgs(argv: string[]): ParsedArgs {
  const args: ParsedArgs = {
    runsRoot: DEFAULT_RUNS_ROOT,
    sampleLimit: 20,
    verbose: false
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

function buildSidecarIndex(runsRoot: string): SidecarIndex {
  const byBaseName = new Map<string, SidecarInfo[]>();

  let matchedSidecarCount = 0;
  let unreadableJsonCount = 0;
  let withPhotoTakenTimeCount = 0;
  let withoutPhotoTakenTimeCount = 0;

  walk(runsRoot, (fullPath) => {
    const baseName = path.basename(fullPath);

    if (!isTakeoutSidecarFilename(baseName)) {
      return;
    }

    matchedSidecarCount += 1;

    let parsed: unknown;
    try {
      parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8')) as unknown;
    } catch {
      unreadableJsonCount += 1;
      return;
    }

    const hasPhotoTakenTime =
      parsed !== null &&
      typeof parsed === 'object' &&
      Object.prototype.hasOwnProperty.call(parsed, 'photoTakenTime');

    if (hasPhotoTakenTime) {
      withPhotoTakenTimeCount += 1;
    } else {
      withoutPhotoTakenTimeCount += 1;
    }

    const sidecars = byBaseName.get(baseName) ?? [];
    sidecars.push({
      path: fullPath,
      hasPhotoTakenTime,
      photoTakenTime: hasPhotoTakenTime ? (parsed as Record<string, unknown>).photoTakenTime : undefined
    });
    byBaseName.set(baseName, sidecars);
  });

  return {
    byBaseName,
    stats: {
      matchedSidecarCount,
      unreadableJsonCount,
      withPhotoTakenTimeCount,
      withoutPhotoTakenTimeCount
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

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  if (!fs.existsSync(args.runsRoot)) {
    throw new Error(`Runs root does not exist: ${args.runsRoot}`);
  }

  console.log(`Scanning Takeout sidecars under: ${args.runsRoot}`);
  const sidecarIndex = buildSidecarIndex(args.runsRoot);

  console.log('');
  console.log('Sidecar scan summary:');
  console.log(
    `  matched sidecar JSON files:                         ${sidecarIndex.stats.matchedSidecarCount}`
  );
  console.log(
    `  readable matched sidecars WITH photoTakenTime:     ${sidecarIndex.stats.withPhotoTakenTimeCount}`
  );
  console.log(
    `  readable matched sidecars WITHOUT photoTakenTime:  ${sidecarIndex.stats.withoutPhotoTakenTimeCount}`
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
      captureDateTime: 1
    }
  ).lean()) as MediaAssetDoc[];

  let unknownCaptureAssetCount = 0;
  let assetsWithMatchedSidecar = 0;
  let assetsWithMatchedSidecarAndPhotoTakenTime = 0;
  let assetsWithMatchedSidecarButNoPhotoTakenTime = 0;
  let assetsWithoutMatchedSidecar = 0;
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

    if (matches.length === 0) {
      assetsWithoutMatchedSidecar += 1;

      if (sampleWithoutSidecar.length < args.sampleLimit) {
        sampleWithoutSidecar.push({
          asset: getAssetLabel(doc),
          candidateSidecars: candidateBaseNames
        });
      }
      continue;
    }

    assetsWithMatchedSidecar += 1;

    if (matches.length > 1) {
      assetsWithMultipleMatchedSidecars += 1;
    }

    if (matches.some((match) => match.hasPhotoTakenTime)) {
      assetsWithMatchedSidecarAndPhotoTakenTime += 1;

      if (sampleWithPhotoTakenTime.length < args.sampleLimit) {
        sampleWithPhotoTakenTime.push({
          asset: getAssetLabel(doc),
          matchedSidecars: matches
            .filter((match) => match.hasPhotoTakenTime)
            .slice(0, 5)
            .map((match) => ({
              path: match.path,
              photoTakenTime: match.photoTakenTime
            }))
        });
      }
      continue;
    }

    assetsWithMatchedSidecarButNoPhotoTakenTime += 1;

    if (sampleWithSidecarButNoPhotoTakenTime.length < args.sampleLimit) {
      sampleWithSidecarButNoPhotoTakenTime.push({
        asset: getAssetLabel(doc),
        matchedSidecars: matches.slice(0, 5).map((match) => match.path)
      });
    }
  }

  console.log('');
  console.log('Unknown-capture asset summary:');
  console.log(`  assets with unknown captureDateTime:               ${unknownCaptureAssetCount}`);
  console.log(`  of those, assets with any matched sidecar:        ${assetsWithMatchedSidecar}`);
  console.log(
    `  of those, matched sidecar has photoTakenTime:     ${assetsWithMatchedSidecarAndPhotoTakenTime}`
  );
  console.log(
    `  of those, matched sidecar lacks photoTakenTime:   ${assetsWithMatchedSidecarButNoPhotoTakenTime}`
  );
  console.log(`  of those, no matched sidecar found:               ${assetsWithoutMatchedSidecar}`);
  console.log(`  assets with multiple matched sidecars:            ${assetsWithMultipleMatchedSidecars}`);

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
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
