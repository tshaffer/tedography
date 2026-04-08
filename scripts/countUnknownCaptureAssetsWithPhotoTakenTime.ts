#!/usr/bin/env node

/**
 * countUnknownCaptureAssetsWithPhotoTakenTime.ts
 *
 * Tedography-specific script:
 * - uses Tedography's existing Mongoose/db wiring
 * - queries MediaAsset documents through the app model
 * - scans Google Takeout sidecars under /Volumes/ShMedia/PHOTO_ARCHIVE/RUNS
 * - counts how many "Captured: Unknown" assets have a matching sidecar
 *   containing photoTakenTime
 *
 * Assumptions:
 * - "Captured: Unknown" means captureDateTime is missing, null, or empty string
 * - sidecar matching is filename-based
 * - AppleDouble files like "._IMG_1234.jpg.json" are ignored
 *
 * Run from the tedography repo root, for example:
 *
 *   pnpm exec tsx scripts/countUnknownCaptureAssetsWithPhotoTakenTime.ts
 *
 * Optional flags:
 *   --runs-root /Volumes/ShMedia/PHOTO_ARCHIVE/RUNS
 *   --sample-limit 20
 *   --verbose
 */

import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";

// ADJUST THESE TWO IMPORTS IF YOUR ACTUAL PATHS DIFFER.
import { connectToDatabase } from "../apps/api/src/db";
import { MediaAssetModel } from "../apps/api/src/models/MediaAsset";

const DEFAULT_RUNS_ROOT = "/Volumes/ShMedia/PHOTO_ARCHIVE/RUNS";

const MEDIA_EXTENSIONS = [
  ".jpg", ".jpeg", ".png", ".heic", ".heif", ".webp", ".gif",
  ".tif", ".tiff", ".bmp", ".dng", ".mp4", ".mov", ".avi",
  ".m4v", ".3gp", ".mts", ".m2ts", ".webm",
];

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
  originalFilename?: string;
  originalArchivePath?: string;
  originalPath?: string;
  path?: string;
  captureDateTime?: string | null;
};

function parseArgs(argv: string[]): ParsedArgs {
  const args: ParsedArgs = {
    runsRoot: DEFAULT_RUNS_ROOT,
    sampleLimit: 20,
    verbose: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--runs-root") {
      args.runsRoot = argv[++i];
    } else if (arg === "--sample-limit") {
      args.sampleLimit = Number(argv[++i]);
    } else if (arg === "--verbose") {
      args.verbose = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelpAndExit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      printHelpAndExit(1);
    }
  }

  if (!Number.isFinite(args.sampleLimit) || args.sampleLimit < 0) {
    throw new Error(`Invalid --sample-limit: ${args.sampleLimit}`);
  }

  return args;
}

function printHelpAndExit(code: number): never {
  console.log(`
Usage:
  pnpm exec tsx scripts/countUnknownCaptureAssetsWithPhotoTakenTime.ts

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

  if (lower.startsWith("._")) {
    return false;
  }

  if (lower.endsWith(".supplemental-metadata.json")) {
    return true;
  }

  return MEDIA_EXTENSIONS.some((ext) => lower.endsWith(`${ext}.json`));
}

function walk(dirPath: string, visitor: (fullPath: string) => void): void {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      walk(fullPath, visitor);
    } else if (entry.isFile()) {
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
      const text = fs.readFileSync(fullPath, "utf8");
      parsed = JSON.parse(text);
    } catch {
      unreadableJsonCount += 1;
      return;
    }

    const hasPhotoTakenTime =
      parsed !== null &&
      typeof parsed === "object" &&
      Object.prototype.hasOwnProperty.call(parsed, "photoTakenTime");

    if (hasPhotoTakenTime) {
      withPhotoTakenTimeCount += 1;
    } else {
      withoutPhotoTakenTimeCount += 1;
    }

    const existing = byBaseName.get(baseName) ?? [];
    existing.push({
      path: fullPath,
      hasPhotoTakenTime,
      photoTakenTime: hasPhotoTakenTime
        ? (parsed as Record<string, unknown>).photoTakenTime
        : undefined,
    });
    byBaseName.set(baseName, existing);
  });

  return {
    byBaseName,
    stats: {
      matchedSidecarCount,
      unreadableJsonCount,
      withPhotoTakenTimeCount,
      withoutPhotoTakenTimeCount,
    },
  };
}

function getCandidateSidecarBaseNames(doc: MediaAssetDoc): string[] {
  const baseNames = new Set<string>();

  const filenameCandidates = [
    doc.filename,
    doc.originalFilename,
    doc.originalArchivePath ? path.basename(doc.originalArchivePath) : undefined,
    doc.originalPath ? path.basename(doc.originalPath) : undefined,
    doc.path ? path.basename(doc.path) : undefined,
  ].filter(Boolean) as string[];

  for (const fileName of filenameCandidates) {
    baseNames.add(`${fileName}.supplemental-metadata.json`);
    baseNames.add(`${fileName}.json`);
  }

  return [...baseNames];
}

function getAssetLabel(doc: MediaAssetDoc): string {
  return (
    doc.originalArchivePath ||
    doc.path ||
    doc.filename ||
    doc.originalFilename ||
    String(doc._id)
  );
}

async function connectTedographyMongoose(): Promise<void> {
  /**
   * This supports a few common patterns:
   * 1. db.ts exports connectToDatabase()
   * 2. db.ts default export is a connect function
   * 3. importing db.ts causes connection as a side effect
   */

  const maybeFn = connectToDatabase as unknown;

  if (typeof maybeFn === "function") {
    await maybeFn();
    return;
  }

  if (mongoose.connection.readyState !== 1) {
    throw new Error(
      "Mongoose is not connected. Update the db import/call in this script to match Tedography's actual db.ts API."
    );
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  if (!fs.existsSync(args.runsRoot)) {
    throw new Error(`Runs root does not exist: ${args.runsRoot}`);
  }

  console.log(`Scanning Takeout sidecars under: ${args.runsRoot}`);
  const sidecarIndex = buildSidecarIndex(args.runsRoot);

  console.log("");
  console.log("Sidecar scan summary:");
  console.log(`  matched sidecar JSON files:                         ${sidecarIndex.stats.matchedSidecarCount}`);
  console.log(`  readable matched sidecars WITH photoTakenTime:     ${sidecarIndex.stats.withPhotoTakenTimeCount}`);
  console.log(`  readable matched sidecars WITHOUT photoTakenTime:  ${sidecarIndex.stats.withoutPhotoTakenTimeCount}`);
  console.log(`  unreadable matched sidecars:                       ${sidecarIndex.stats.unreadableJsonCount}`);

  console.log("");
  console.log("Connecting through Tedography Mongoose...");
  await connectTedographyMongoose();

  const query = {
    $or: [
      { captureDateTime: { $exists: false } },
      { captureDateTime: null },
      { captureDateTime: "" },
    ],
  };

  const docs = (await MediaAssetModel.find(query, {
    _id: 1,
    filename: 1,
    originalFilename: 1,
    originalArchivePath: 1,
    originalPath: 1,
    path: 1,
    captureDateTime: 1,
  }).lean()) as MediaAssetDoc[];

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
          candidateSidecars: candidateBaseNames,
        });
      }
      continue;
    }

    assetsWithMatchedSidecar += 1;

    if (matches.length > 1) {
      assetsWithMultipleMatchedSidecars += 1;
    }

    const hasPhotoTakenTime = matches.some((m) => m.hasPhotoTakenTime);

    if (hasPhotoTakenTime) {
      assetsWithMatchedSidecarAndPhotoTakenTime += 1;

      if (sampleWithPhotoTakenTime.length < args.sampleLimit) {
        sampleWithPhotoTakenTime.push({
          asset: getAssetLabel(doc),
          matchedSidecars: matches
            .filter((m) => m.hasPhotoTakenTime)
            .slice(0, 5)
            .map((m) => ({
              path: m.path,
              photoTakenTime: m.photoTakenTime,
            })),
        });
      }
    } else {
      assetsWithMatchedSidecarButNoPhotoTakenTime += 1;

      if (sampleWithSidecarButNoPhotoTakenTime.length < args.sampleLimit) {
        sampleWithSidecarButNoPhotoTakenTime.push({
          asset: getAssetLabel(doc),
          matchedSidecars: matches.slice(0, 5).map((m) => m.path),
        });
      }
    }
  }

  console.log("");
  console.log("Unknown-capture asset summary:");
  console.log(`  assets with Captured: Unknown:                    ${unknownCaptureAssetCount}`);
  console.log(`  of those, assets with any matched sidecar:        ${assetsWithMatchedSidecar}`);
  console.log(`  of those, matched sidecar has photoTakenTime:     ${assetsWithMatchedSidecarAndPhotoTakenTime}`);
  console.log(`  of those, matched sidecar lacks photoTakenTime:   ${assetsWithMatchedSidecarButNoPhotoTakenTime}`);
  console.log(`  of those, no matched sidecar found:               ${assetsWithoutMatchedSidecar}`);
  console.log(`  assets with multiple matched sidecars:            ${assetsWithMultipleMatchedSidecars}`);

  if (args.verbose) {
    console.log("");
    console.log("Sample assets with matched sidecars containing photoTakenTime:");
    for (const sample of sampleWithPhotoTakenTime) {
      console.log(`- ${sample.asset}`);
      for (const match of sample.matchedSidecars) {
        console.log(`    ${match.path} :: ${JSON.stringify(match.photoTakenTime)}`);
      }
    }

    console.log("");
    console.log("Sample assets with no matched sidecar:");
    for (const sample of sampleWithoutSidecar) {
      console.log(`- ${sample.asset}`);
      for (const candidate of sample.candidateSidecars.slice(0, 5)) {
        console.log(`    candidate: ${candidate}`);
      }
    }

    console.log("");
    console.log("Sample assets with matched sidecar but no photoTakenTime:");
    for (const sample of sampleWithSidecarButNoPhotoTakenTime) {
      console.log(`- ${sample.asset}`);
      for (const matchPath of sample.matchedSidecars) {
        console.log(`    ${matchPath}`);
      }
    }
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
