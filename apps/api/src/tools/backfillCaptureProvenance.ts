import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { exiftool } from 'exiftool-vendored';
import type { CaptureDateTimeSource } from '@tedography/domain';
import { connectToMongo } from '../db.js';
import { log } from '../logger.js';
import { MediaAssetModel } from '../models/mediaAssetModel.js';
import {
  extractCaptureDateFieldsFromTags,
  type CaptureDateTag
} from '../import/exifMetadata.js';
import { classifyStoredCaptureDate } from '../import/captureProvenance.js';
import { getStorageRootById } from '../import/storageRoots.js';

interface ScriptOptions {
  apply: boolean;
  force: boolean;
  limit: number | null;
  assetId: string | null;
}

type AnomalyKind = 'unknown-storage-root' | 'missing-file' | 'exif-read-failed';

interface ReportRow {
  id: string;
  filename: string;
  originalArchivePath: string;
  classification: Exclude<CaptureDateTimeSource, 'manual'> | null;
  storedCaptureDateTime: string | null;
  fileCaptureDateTime: string | null;
  captureDateTimeTag: CaptureDateTag | null;
  cameraMake: string | null;
  cameraModel: string | null;
  anomaly: AnomalyKind | null;
}

// Cameras that lose their clock typically reset to one of these dates.
const CLOCK_RESET_DATE_PREFIXES = ['2000-01-01', '1980-01-01', '1970-01-01'];

const BATCH_SIZE = 8;
const APPLY_CHUNK_SIZE = 500;
const PROGRESS_INTERVAL = 250;

function parseArgs(argv: string[]): ScriptOptions {
  const options: ScriptOptions = { apply: false, force: false, limit: null, assetId: null };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]?.trim();
    if (!arg) {
      continue;
    }

    if (arg === '--apply') {
      options.apply = true;
      continue;
    }

    if (arg === '--force') {
      options.force = true;
      continue;
    }

    if (arg === '--limit' || arg.startsWith('--limit=')) {
      const rawValue = arg === '--limit' ? argv[(index += 1)]?.trim() : arg.slice('--limit='.length);
      const parsed = Number.parseInt(rawValue ?? '', 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error('--limit must be a positive integer');
      }
      options.limit = parsed;
      continue;
    }

    if (arg === '--asset-id' || arg.startsWith('--asset-id=')) {
      const value = arg === '--asset-id' ? argv[(index += 1)]?.trim() : arg.slice('--asset-id='.length).trim();
      if (!value) {
        throw new Error('Missing value for --asset-id');
      }
      options.assetId = value;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    }
  }

  return options;
}

function printUsage(): void {
  console.log(`Backfill captureDateTime provenance fields from original-file EXIF.

Reads each asset's original file (read-only), classifies where the stored
captureDateTime came from, and reports. Writes nothing without --apply.
Never modifies captureDateTime itself, and never writes to photo files.

Usage:
  pnpm capture-provenance:backfill [--apply] [--force] [--limit N] [--asset-id ID]

Options:
  --apply         Persist captureDateTimeSource/exifCaptureDateTime/cameraMake/cameraModel.
  --force         Re-process assets that already have captureDateTimeSource.
  --limit N       Process at most N assets.
  --asset-id ID   Restrict processing to one asset id.
`);
}

function parseStoredDate(value: string | null | undefined): Date | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function processAsset(asset: {
  id: string;
  filename: string;
  captureDateTime?: string | null;
  originalStorageRootId: string;
  originalArchivePath: string;
}): Promise<ReportRow> {
  const row: ReportRow = {
    id: asset.id,
    filename: asset.filename,
    originalArchivePath: asset.originalArchivePath,
    classification: null,
    storedCaptureDateTime: asset.captureDateTime ?? null,
    fileCaptureDateTime: null,
    captureDateTimeTag: null,
    cameraMake: null,
    cameraModel: null,
    anomaly: null
  };

  const root = getStorageRootById(asset.originalStorageRootId);
  if (!root) {
    row.anomaly = 'unknown-storage-root';
    return row;
  }

  const absolutePath = path.join(root.absolutePath, asset.originalArchivePath);
  if (!fs.existsSync(absolutePath)) {
    row.anomaly = 'missing-file';
    return row;
  }

  let tags: Record<string, unknown>;
  try {
    tags = (await exiftool.read(absolutePath)) as unknown as Record<string, unknown>;
  } catch {
    row.anomaly = 'exif-read-failed';
    return row;
  }

  const fileFields = extractCaptureDateFieldsFromTags(tags);
  row.fileCaptureDateTime = fileFields.captureDateTime?.toISOString() ?? null;
  row.captureDateTimeTag = fileFields.captureDateTimeTag;
  row.cameraMake = fileFields.cameraMake;
  row.cameraModel = fileFields.cameraModel;
  row.classification = classifyStoredCaptureDate({
    storedCaptureDateTime: parseStoredDate(asset.captureDateTime),
    fileFields
  });

  return row;
}

function buildSummary(rows: ReportRow[]): {
  classificationCounts: Record<string, number>;
  anomalyCounts: Record<string, number>;
  cameraModelYearMatrix: Record<string, Record<string, number>>;
  clockResetHits: Array<{ id: string; filename: string; storedCaptureDateTime: string }>;
} {
  const classificationCounts: Record<string, number> = {};
  const anomalyCounts: Record<string, number> = {};
  const cameraModelYearMatrix: Record<string, Record<string, number>> = {};
  const clockResetHits: Array<{ id: string; filename: string; storedCaptureDateTime: string }> = [];

  for (const row of rows) {
    if (row.anomaly) {
      anomalyCounts[row.anomaly] = (anomalyCounts[row.anomaly] ?? 0) + 1;
      continue;
    }

    const classification = row.classification ?? 'unclassified';
    classificationCounts[classification] = (classificationCounts[classification] ?? 0) + 1;

    if (row.storedCaptureDateTime) {
      const camera = [row.cameraMake, row.cameraModel].filter(Boolean).join(' ') || '(no camera tags)';
      const year = row.storedCaptureDateTime.slice(0, 4);
      const yearCounts = (cameraModelYearMatrix[camera] ??= {});
      yearCounts[year] = (yearCounts[year] ?? 0) + 1;

      if (CLOCK_RESET_DATE_PREFIXES.some((prefix) => row.storedCaptureDateTime?.startsWith(prefix))) {
        clockResetHits.push({
          id: row.id,
          filename: row.filename,
          storedCaptureDateTime: row.storedCaptureDateTime
        });
      }
    }
  }

  return { classificationCounts, anomalyCounts, cameraModelYearMatrix, clockResetHits };
}

async function applyRows(rows: ReportRow[]): Promise<number> {
  const applicable = rows.filter((row) => row.anomaly === null && row.classification !== null);

  for (let start = 0; start < applicable.length; start += APPLY_CHUNK_SIZE) {
    const chunk = applicable.slice(start, start + APPLY_CHUNK_SIZE);
    await MediaAssetModel.bulkWrite(
      chunk.map((row) => ({
        updateOne: {
          filter: { id: row.id },
          update: {
            $set: {
              captureDateTimeSource: row.classification,
              exifCaptureDateTime: row.fileCaptureDateTime,
              cameraMake: row.cameraMake,
              cameraModel: row.cameraModel
            }
          }
        }
      })),
      { ordered: false }
    );
    log.info(`Applied ${Math.min(start + APPLY_CHUNK_SIZE, applicable.length)}/${applicable.length}`);
  }

  return applicable.length;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  log.info(
    `Starting capture-provenance backfill in ${options.apply ? 'APPLY' : 'dry-run'} mode${options.force ? ' (force)' : ''}${options.limit ? ` (limit=${options.limit})` : ''}${options.assetId ? ` (assetId=${options.assetId})` : ''}`
  );

  await connectToMongo();

  try {
    const query: Record<string, unknown> = {};
    if (!options.force) {
      query.$or = [
        { captureDateTimeSource: { $exists: false } },
        { captureDateTimeSource: null }
      ];
    }
    if (options.assetId) {
      query.id = options.assetId;
    }

    const candidates = await MediaAssetModel.find(query, {
      _id: 0,
      id: 1,
      filename: 1,
      captureDateTime: 1,
      originalStorageRootId: 1,
      originalArchivePath: 1
    })
      .sort({ importedAt: 1, id: 1 })
      .limit(options.limit ?? 0)
      .lean<
        Array<{
          id: string;
          filename: string;
          captureDateTime?: string | null;
          originalStorageRootId: string;
          originalArchivePath: string;
        }>
      >();

    log.info(`Found ${candidates.length} candidate assets`);

    const rows: ReportRow[] = [];
    for (let start = 0; start < candidates.length; start += BATCH_SIZE) {
      const batch = candidates.slice(start, start + BATCH_SIZE);
      const batchRows = await Promise.all(batch.map((asset) => processAsset(asset)));
      rows.push(...batchRows);

      if (rows.length % PROGRESS_INTERVAL < BATCH_SIZE && rows.length >= PROGRESS_INTERVAL) {
        log.info(`Processed ${rows.length}/${candidates.length}`);
      }
    }

    const summary = buildSummary(rows);

    const reportsDir = path.resolve(process.cwd(), '../../reports');
    fs.mkdirSync(reportsDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(reportsDir, `capture-provenance-${timestamp}.json`);
    fs.writeFileSync(
      reportPath,
      JSON.stringify({ mode: options.apply ? 'apply' : 'dry-run', generatedAt: new Date().toISOString(), summary, rows }, null, 2)
    );

    log.info(`Classification counts: ${JSON.stringify(summary.classificationCounts)}`);
    log.info(`Anomaly counts: ${JSON.stringify(summary.anomalyCounts)}`);
    log.info(`Clock-reset date hits: ${summary.clockResetHits.length}`);
    log.info(`Camera models seen: ${Object.keys(summary.cameraModelYearMatrix).length}`);
    log.info(`Full report: ${reportPath}`);

    if (options.apply) {
      const appliedCount = await applyRows(rows);
      log.info(`Applied provenance fields to ${appliedCount} assets`);
    } else {
      log.info('Dry-run only. Re-run with --apply to persist provenance fields.');
    }

    const anomalyTotal = Object.values(summary.anomalyCounts).reduce((sum, count) => sum + count, 0);
    if (anomalyTotal > 0) {
      log.warn(`${anomalyTotal} assets had anomalies and were not classified (see report)`);
    }
  } finally {
    await exiftool.end();
    await mongoose.disconnect();
    log.info('Disconnected from MongoDB');
  }
}

void main();
