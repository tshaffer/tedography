/**
 * Strict Tedography photoState migration helper.
 *
 * Default mode is dry-run and never writes to either database.
 *
 * How to run from the repo root:
 *   MONGODB_URI="mongodb+srv://..." pnpm photo-state-poc
 *   MONGODB_URI="mongodb+srv://..." pnpm photo-state-poc --apply --limit 10
 *
 * Optional env vars:
 *   TEDOGRAPHY_MONGODB_URI             Override the Tedography MongoDB URI
 *   SHAFFEROGRAPHY_MONGODB_URI         Override the Shafferography MongoDB URI
 *   SHAFFEROGRAPHY_MEDIA_COLLECTION    Override the Shafferography media collection name
 *
 * Output files are written to:
 *   scripts/output/
 */

import 'dotenv/config';

import fs from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';

type TedographyPhotoState = 'New' | 'Pending' | 'Keep' | 'Discard';
type ShafferographyPhotoState =
  | 'unreviewed'
  | 'undecided'
  | 'pendingEdits'
  | 'readyForUpload'
  | 'uploaded'
  | 'deleted';

interface CliOptions {
  apply: boolean;
  limit: number | null;
  ids: string[] | null;
  verbose: boolean;
}

interface TedographyAssetDocument {
  id?: unknown;
  filename?: unknown;
  captureDateTime?: unknown;
  width?: unknown;
  height?: unknown;
  photoState?: unknown;
  originalArchivePath?: unknown;
  originalStorageRootId?: unknown;
  originalFileSizeBytes?: unknown;
  originalContentHash?: unknown;
}

interface ShafferographyAssetDocument {
  uniqueId?: unknown;
  fileName?: unknown;
  creationTime?: unknown;
  googleTakenAtIso?: unknown;
  exif?: {
    takenAt?: unknown;
    imageWidth?: unknown;
    imageHeight?: unknown;
    originalWidth?: unknown;
    originalHeight?: unknown;
  } | null;
  photoState?: unknown;
  filePath?: unknown;
  contentHash?: unknown;
}

interface NormalizedTedographyAsset {
  tedographyId: string;
  tedographyFilename: string;
  tedographyCaptureDateTime: string | null;
  tedographyCaptureEpochMs: number | null;
  tedographyWidth: number | null;
  tedographyHeight: number | null;
  tedographyPhotoState: string | null;
  tedographyOriginalArchivePath: string | null;
  tedographyOriginalStorageRootId: string | null;
  tedographyOriginalFileSizeBytes: number | null;
  tedographyOriginalContentHash: string | null;
  normalizedStem: string;
}

interface NormalizedShafferographyAsset {
  shafferographyUniqueId: string;
  shafferographyFileName: string;
  shafferographyCaptureTimeUsed: string | null;
  shafferographyCaptureEpochMs: number | null;
  shafferographyCaptureFieldUsed: 'creationTime' | 'exif.takenAt' | 'googleTakenAtIso' | null;
  shafferographyWidth: number | null;
  shafferographyHeight: number | null;
  shafferographyPhotoState: string | null;
  shafferographyFilePath: string | null;
  shafferographyContentHash: string | null;
  normalizedStem: string;
}

interface MatchedCsvRow {
  tedographyId: string;
  tedographyFilename: string;
  proposedTedographyPhotoState: string;
  shafferographyUniqueId: string;
  shafferographyFileName: string;
  shafferographyPhotoState: string;
  matchReason: string;
  tedographyCaptureDateTime: string;
  tedographyWidth: string;
  tedographyHeight: string;
  tedographyOriginalArchivePath: string;
  shafferographyCaptureTimeUsed: string;
  shafferographyWidth: string;
  shafferographyHeight: string;
  shafferographyFilePath: string;
}

interface AmbiguousCsvRow {
  tedographyId: string;
  tedographyFilename: string;
  tedographyCaptureDateTime: string;
  tedographyOriginalArchivePath: string;
  candidateCount: string;
  candidateSummaries: string;
}

interface UnmatchedCsvRow {
  tedographyId: string;
  tedographyFilename: string;
  tedographyCaptureDateTime: string;
  tedographyWidth: string;
  tedographyHeight: string;
  tedographyPhotoState: string;
  tedographyOriginalArchivePath: string;
  normalizedStem: string;
}

interface UpdatedCsvRow {
  tedographyId: string;
  tedographyFilename: string;
  tedographyOriginalArchivePath: string;
  tedographyOldPhotoState: string;
  tedographyNewPhotoState: string;
  shafferographyUniqueId: string;
  shafferographyFileName: string;
  shafferographyPhotoState: string;
  matchReason: string;
  updatedAtIso: string;
}

interface NoopCsvRow {
  tedographyId: string;
  tedographyFilename: string;
  tedographyPhotoState: string;
  shafferographyUniqueId: string;
  shafferographyPhotoState: string;
  mappedTedographyPhotoState: string;
  reason: string;
}

interface SkippedCsvRow {
  tedographyId: string;
  tedographyFilename: string;
  reason: string;
  details: string;
}

interface SummaryReport {
  mode: 'dry-run' | 'apply';
  tedographyAssetsScanned: number;
  shafferographyCandidatesScanned: number;
  uniqueMatches: number;
  ambiguousMatches: number;
  unmatched: number;
  eligibleForUpdate: number;
  updatedCount: number;
  noopCount: number;
  skippedCount: number;
  limitApplied: number | null;
  startedAtIso: string;
  finishedAtIso: string;
  shafferographyStateCountsForMatches: Record<string, number>;
  proposedTedographyStateCounts: Record<string, number>;
  notes: string[];
}

interface EligibleUpdate {
  tedographyAsset: NormalizedTedographyAsset;
  match: NormalizedShafferographyAsset;
  proposedTedographyPhotoState: TedographyPhotoState;
  matchReason: string;
}

type MatchClassification = 'unique_match' | 'ambiguous_match' | 'no_match';

const TEDOGRAPHY_DB_NAME = 'tedography';
const TEDOGRAPHY_COLLECTION_NAME = 'mediaAssets';
const SHAFFEROGRAPHY_DB_NAME = 'pgPhotos';
const DEFAULT_SHAFFEROGRAPHY_COLLECTION_NAME = 'mediaitems';
const TEDOGRAPHY_PHOTO_STATES: TedographyPhotoState[] = ['New', 'Pending', 'Keep', 'Discard'];

const outputDirectory = path.resolve(process.cwd(), 'scripts/output');

function parseCliOptions(argv: string[]): CliOptions {
  let apply = false;
  let limit: number | null = null;
  let ids: string[] | null = null;
  let verbose = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--apply') {
      apply = true;
      continue;
    }

    if (argument === '--verbose') {
      verbose = true;
      continue;
    }

    if (argument === '--limit') {
      const rawValue = argv[index + 1];
      if (!rawValue) {
        throw new Error('Expected a numeric value after --limit.');
      }

      const parsed = Number.parseInt(rawValue, 10);
      if (!Number.isInteger(parsed) || parsed < 0) {
        throw new Error(`Invalid --limit value: ${rawValue}`);
      }

      limit = parsed;
      index += 1;
      continue;
    }

    if (argument === '--ids') {
      const rawValue = argv[index + 1];
      if (!rawValue) {
        throw new Error('Expected a comma-separated value after --ids.');
      }

      const parsedIds = rawValue
        .split(',')
        .map((value) => value.trim())
        .filter((value) => value.length > 0);

      if (parsedIds.length === 0) {
        throw new Error('Expected at least one Tedography id in --ids.');
      }

      ids = Array.from(new Set(parsedIds));
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  return { apply, limit, ids, verbose };
}

function getRequiredMongoUri(): { tedographyUri: string; shafferographyUri: string } {
  const sharedUri = process.env.MONGODB_URI?.trim();
  const tedographyUri = process.env.TEDOGRAPHY_MONGODB_URI?.trim() || sharedUri;
  const shafferographyUri = process.env.SHAFFEROGRAPHY_MONGODB_URI?.trim() || sharedUri;

  if (!tedographyUri || !shafferographyUri) {
    throw new Error(
      'Set MONGODB_URI or both TEDOGRAPHY_MONGODB_URI and SHAFFEROGRAPHY_MONGODB_URI before running this script.'
    );
  }

  return { tedographyUri, shafferographyUri };
}

function getShafferographyCollectionName(): string {
  const override = process.env.SHAFFEROGRAPHY_MEDIA_COLLECTION?.trim();
  return override && override.length > 0 ? override : DEFAULT_SHAFFEROGRAPHY_COLLECTION_NAME;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeFilenameStem(filename: string | null): string {
  if (!filename) {
    return '';
  }

  const basename = path.basename(filename).trim().toLowerCase();
  const extension = path.extname(basename);
  return extension.length > 0 ? basename.slice(0, -extension.length) : basename;
}

function parseEpochMilliseconds(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const epochMs = Date.parse(value);
  return Number.isFinite(epochMs) ? epochMs : null;
}

function chooseShafferographyCaptureTime(
  document: ShafferographyAssetDocument
): {
  isoValue: string | null;
  epochMs: number | null;
  fieldUsed: 'creationTime' | 'exif.takenAt' | 'googleTakenAtIso' | null;
} {
  const captureCandidates: Array<{
    fieldUsed: 'creationTime' | 'exif.takenAt' | 'googleTakenAtIso';
    value: string | null;
  }> = [
    { fieldUsed: 'creationTime', value: asString(document.creationTime) },
    { fieldUsed: 'exif.takenAt', value: asString(document.exif?.takenAt) },
    { fieldUsed: 'googleTakenAtIso', value: asString(document.googleTakenAtIso) }
  ];

  for (const candidate of captureCandidates) {
    const epochMs = parseEpochMilliseconds(candidate.value);
    if (epochMs !== null) {
      return {
        isoValue: candidate.value,
        epochMs,
        fieldUsed: candidate.fieldUsed
      };
    }
  }

  return {
    isoValue: null,
    epochMs: null,
    fieldUsed: null
  };
}

function chooseShafferographyDimensions(document: ShafferographyAssetDocument): {
  width: number | null;
  height: number | null;
} {
  const width = asNumber(document.exif?.imageWidth) ?? asNumber(document.exif?.originalWidth);
  const height = asNumber(document.exif?.imageHeight) ?? asNumber(document.exif?.originalHeight);

  return { width, height };
}

function normalizeTedographyAsset(document: TedographyAssetDocument): NormalizedTedographyAsset | null {
  const tedographyId = asString(document.id);
  if (!tedographyId) {
    return null;
  }

  const tedographyFilename = asString(document.filename) ?? '';
  const tedographyCaptureDateTime = asString(document.captureDateTime);

  return {
    tedographyId,
    tedographyFilename,
    tedographyCaptureDateTime,
    tedographyCaptureEpochMs: parseEpochMilliseconds(tedographyCaptureDateTime),
    tedographyWidth: asNumber(document.width),
    tedographyHeight: asNumber(document.height),
    tedographyPhotoState: asString(document.photoState),
    tedographyOriginalArchivePath: asString(document.originalArchivePath),
    tedographyOriginalStorageRootId: asString(document.originalStorageRootId),
    tedographyOriginalFileSizeBytes: asNumber(document.originalFileSizeBytes),
    tedographyOriginalContentHash: asString(document.originalContentHash),
    normalizedStem: normalizeFilenameStem(tedographyFilename)
  };
}

function normalizeShafferographyAsset(
  document: ShafferographyAssetDocument
): NormalizedShafferographyAsset | null {
  const shafferographyUniqueId = asString(document.uniqueId);
  if (!shafferographyUniqueId) {
    return null;
  }

  const shafferographyFileName = asString(document.fileName) ?? '';
  const captureTime = chooseShafferographyCaptureTime(document);
  const dimensions = chooseShafferographyDimensions(document);

  return {
    shafferographyUniqueId,
    shafferographyFileName,
    shafferographyCaptureTimeUsed: captureTime.isoValue,
    shafferographyCaptureEpochMs: captureTime.epochMs,
    shafferographyCaptureFieldUsed: captureTime.fieldUsed,
    shafferographyWidth: dimensions.width,
    shafferographyHeight: dimensions.height,
    shafferographyPhotoState: asString(document.photoState),
    shafferographyFilePath: asString(document.filePath),
    shafferographyContentHash: asString(document.contentHash),
    normalizedStem: normalizeFilenameStem(shafferographyFileName)
  };
}

function buildShafferographyIndexKey(normalizedStem: string, captureEpochMs: number | null): string | null {
  if (normalizedStem.length === 0 || captureEpochMs === null) {
    return null;
  }

  return `${normalizedStem}::${captureEpochMs}`;
}

function dimensionsMatch(
  tedographyAsset: NormalizedTedographyAsset,
  shafferographyAsset: NormalizedShafferographyAsset
): boolean {
  if (
    tedographyAsset.tedographyWidth !== null &&
    tedographyAsset.tedographyHeight !== null &&
    shafferographyAsset.shafferographyWidth !== null &&
    shafferographyAsset.shafferographyHeight !== null
  ) {
    return (
      tedographyAsset.tedographyWidth === shafferographyAsset.shafferographyWidth &&
      tedographyAsset.tedographyHeight === shafferographyAsset.shafferographyHeight
    );
  }

  return true;
}

function mapShafferographyPhotoState(photoState: string | null): TedographyPhotoState | null {
  switch (photoState) {
    case 'undecided':
      return 'New';
    case 'pendingEdits':
      return 'Pending';
    case 'readyForUpload':
    case 'uploaded':
      return 'Keep';
    case 'deleted':
      return 'Discard';
    default:
      return null;
  }
}

function isTedographyPhotoState(photoState: string | null): photoState is TedographyPhotoState {
  return photoState !== null && TEDOGRAPHY_PHOTO_STATES.includes(photoState as TedographyPhotoState);
}

function buildMatchReason(
  tedographyAsset: NormalizedTedographyAsset,
  match: NormalizedShafferographyAsset
): string {
  return tedographyAsset.tedographyWidth !== null &&
    tedographyAsset.tedographyHeight !== null &&
    match.shafferographyWidth !== null &&
    match.shafferographyHeight !== null
    ? 'normalized filename stem + exact capture instant + exact dimensions'
    : 'normalized filename stem + exact capture instant';
}

function toCsvValue(value: string): string {
  if (value.includes('"') || value.includes(',') || value.includes('\n')) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  return value;
}

function writeCsv<T extends object>(rows: T[], columnOrder: Array<keyof T>): string {
  const header = columnOrder.join(',');
  const body = rows.map((row) =>
    columnOrder
      .map((column) => {
        const value = row[column];
        return toCsvValue(typeof value === 'string' ? value : '');
      })
      .join(',')
  );

  return `${[header, ...body].join('\n')}\n`;
}

function incrementCount(counts: Record<string, number>, key: string | null): void {
  if (!key) {
    return;
  }

  counts[key] = (counts[key] ?? 0) + 1;
}

function summarizeCandidate(candidate: NormalizedShafferographyAsset): string {
  const dimensions =
    candidate.shafferographyWidth !== null && candidate.shafferographyHeight !== null
      ? `${candidate.shafferographyWidth}x${candidate.shafferographyHeight}`
      : 'no-dimensions';

  return [
    candidate.shafferographyUniqueId,
    candidate.shafferographyFileName || '(no fileName)',
    candidate.shafferographyCaptureFieldUsed
      ? `${candidate.shafferographyCaptureFieldUsed}=${candidate.shafferographyCaptureTimeUsed ?? 'invalid'}`
      : 'no-capture',
    dimensions,
    candidate.shafferographyPhotoState ?? 'unknown-state',
    candidate.shafferographyFilePath ?? '(no filePath)'
  ].join(' | ');
}

function createSkippedRow(
  tedographyId: string,
  tedographyFilename: string,
  reason: string,
  details: string
): SkippedCsvRow {
  return {
    tedographyId,
    tedographyFilename,
    reason,
    details
  };
}

function logVerbose(enabled: boolean, message: string): void {
  if (enabled) {
    console.log(message);
  }
}

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  const startedAtIso = new Date().toISOString();
  const { tedographyUri, shafferographyUri } = getRequiredMongoUri();
  const shafferographyCollectionName = getShafferographyCollectionName();

  const tedographyClient = new mongoose.mongo.MongoClient(tedographyUri);
  const shafferographyClient =
    tedographyUri === shafferographyUri ? tedographyClient : new mongoose.mongo.MongoClient(shafferographyUri);

  const notes: string[] = [];
  const matchedRows: MatchedCsvRow[] = [];
  const ambiguousRows: AmbiguousCsvRow[] = [];
  const unmatchedRows: UnmatchedCsvRow[] = [];
  const updatedRows: UpdatedCsvRow[] = [];
  const noopRows: NoopCsvRow[] = [];
  const skippedRows: SkippedCsvRow[] = [];

  let tedographySkippedMalformed = 0;
  let shafferographySkippedMalformed = 0;
  let tedographyMissingCapture = 0;
  let shafferographyMissingCapture = 0;

  const shafferographyStateCountsForMatches: Record<string, number> = {};
  const proposedTedographyStateCounts: Record<string, number> = {};
  const eligibleUpdates: EligibleUpdate[] = [];

  try {
    await tedographyClient.connect();
    if (shafferographyClient !== tedographyClient) {
      await shafferographyClient.connect();
    }

    const tedographyDb = tedographyClient.db(TEDOGRAPHY_DB_NAME);
    const shafferographyDb = shafferographyClient.db(SHAFFEROGRAPHY_DB_NAME);
    const tedographyCollection = tedographyDb.collection<TedographyAssetDocument>(TEDOGRAPHY_COLLECTION_NAME);

    const tedographyFilter =
      options.ids && options.ids.length > 0
        ? {
            id: { $in: options.ids }
          }
        : {};

    const tedographyDocuments = await tedographyCollection
      .find(tedographyFilter, {
        projection: {
          _id: 0,
          id: 1,
          filename: 1,
          captureDateTime: 1,
          width: 1,
          height: 1,
          photoState: 1,
          originalArchivePath: 1,
          originalStorageRootId: 1,
          originalFileSizeBytes: 1,
          originalContentHash: 1
        }
      })
      .toArray();

    const shafferographyDocuments = await shafferographyDb
      .collection<ShafferographyAssetDocument>(shafferographyCollectionName)
      .find(
        { photoState: { $ne: 'unreviewed' } },
        {
          projection: {
            _id: 0,
            uniqueId: 1,
            fileName: 1,
            creationTime: 1,
            googleTakenAtIso: 1,
            exif: 1,
            photoState: 1,
            filePath: 1,
            contentHash: 1
          }
        }
      )
      .toArray();

    const tedographyAssets: NormalizedTedographyAsset[] = [];
    for (const document of tedographyDocuments) {
      const normalized = normalizeTedographyAsset(document);
      if (!normalized) {
        tedographySkippedMalformed += 1;
        skippedRows.push(
          createSkippedRow(
            asString(document.id) ?? '',
            asString(document.filename) ?? '',
            'malformed_tedography_row',
            'Missing usable Tedography id.'
          )
        );
        continue;
      }

      if (normalized.tedographyCaptureEpochMs === null) {
        tedographyMissingCapture += 1;
      }

      tedographyAssets.push(normalized);
    }

    const shafferographyAssets: NormalizedShafferographyAsset[] = [];
    for (const document of shafferographyDocuments) {
      const normalized = normalizeShafferographyAsset(document);
      if (!normalized) {
        shafferographySkippedMalformed += 1;
        continue;
      }

      if (normalized.shafferographyCaptureEpochMs === null) {
        shafferographyMissingCapture += 1;
      }

      shafferographyAssets.push(normalized);
    }

    const shafferographyCandidatesByKey = new Map<string, NormalizedShafferographyAsset[]>();
    for (const asset of shafferographyAssets) {
      const key = buildShafferographyIndexKey(asset.normalizedStem, asset.shafferographyCaptureEpochMs);
      if (!key) {
        continue;
      }

      const existing = shafferographyCandidatesByKey.get(key) ?? [];
      existing.push(asset);
      shafferographyCandidatesByKey.set(key, existing);
    }

    for (const tedographyAsset of tedographyAssets) {
      const key = buildShafferographyIndexKey(
        tedographyAsset.normalizedStem,
        tedographyAsset.tedographyCaptureEpochMs
      );

      const candidates =
        key === null
          ? []
          : (shafferographyCandidatesByKey.get(key) ?? []).filter((candidate) =>
              dimensionsMatch(tedographyAsset, candidate)
            );

      const classification: MatchClassification =
        candidates.length === 1 ? 'unique_match' : candidates.length > 1 ? 'ambiguous_match' : 'no_match';

      if (classification === 'unique_match') {
        const match = candidates[0];
        const proposedTedographyPhotoState = mapShafferographyPhotoState(match.shafferographyPhotoState);
        const matchReason = buildMatchReason(tedographyAsset, match);

        incrementCount(shafferographyStateCountsForMatches, match.shafferographyPhotoState);
        incrementCount(proposedTedographyStateCounts, proposedTedographyPhotoState);

        matchedRows.push({
          tedographyId: tedographyAsset.tedographyId,
          tedographyFilename: tedographyAsset.tedographyFilename,
          proposedTedographyPhotoState: proposedTedographyPhotoState ?? '',
          shafferographyUniqueId: match.shafferographyUniqueId,
          shafferographyFileName: match.shafferographyFileName,
          shafferographyPhotoState: match.shafferographyPhotoState ?? '',
          matchReason,
          tedographyCaptureDateTime: tedographyAsset.tedographyCaptureDateTime ?? '',
          tedographyWidth: tedographyAsset.tedographyWidth?.toString() ?? '',
          tedographyHeight: tedographyAsset.tedographyHeight?.toString() ?? '',
          tedographyOriginalArchivePath: tedographyAsset.tedographyOriginalArchivePath ?? '',
          shafferographyCaptureTimeUsed: match.shafferographyCaptureTimeUsed ?? '',
          shafferographyWidth: match.shafferographyWidth?.toString() ?? '',
          shafferographyHeight: match.shafferographyHeight?.toString() ?? '',
          shafferographyFilePath: match.shafferographyFilePath ?? ''
        });

        if (!proposedTedographyPhotoState || !isTedographyPhotoState(proposedTedographyPhotoState)) {
          skippedRows.push(
            createSkippedRow(
              tedographyAsset.tedographyId,
              tedographyAsset.tedographyFilename,
              'invalid_mapping',
              `Shafferography photoState "${match.shafferographyPhotoState ?? ''}" does not map to an allowed Tedography photoState.`
            )
          );
          continue;
        }

        if (tedographyAsset.tedographyPhotoState === proposedTedographyPhotoState) {
          noopRows.push({
            tedographyId: tedographyAsset.tedographyId,
            tedographyFilename: tedographyAsset.tedographyFilename,
            tedographyPhotoState: tedographyAsset.tedographyPhotoState ?? '',
            shafferographyUniqueId: match.shafferographyUniqueId,
            shafferographyPhotoState: match.shafferographyPhotoState ?? '',
            mappedTedographyPhotoState: proposedTedographyPhotoState,
            reason: 'already_in_target_state'
          });
          continue;
        }

        eligibleUpdates.push({
          tedographyAsset,
          match,
          proposedTedographyPhotoState,
          matchReason
        });
        continue;
      }

      if (classification === 'ambiguous_match') {
        ambiguousRows.push({
          tedographyId: tedographyAsset.tedographyId,
          tedographyFilename: tedographyAsset.tedographyFilename,
          tedographyCaptureDateTime: tedographyAsset.tedographyCaptureDateTime ?? '',
          tedographyOriginalArchivePath: tedographyAsset.tedographyOriginalArchivePath ?? '',
          candidateCount: candidates.length.toString(),
          candidateSummaries: candidates.map((candidate) => summarizeCandidate(candidate)).join(' || ')
        });
        skippedRows.push(
          createSkippedRow(
            tedographyAsset.tedographyId,
            tedographyAsset.tedographyFilename,
            'ambiguous_match',
            `Found ${candidates.length.toString()} strict candidates.`
          )
        );
        continue;
      }

      unmatchedRows.push({
        tedographyId: tedographyAsset.tedographyId,
        tedographyFilename: tedographyAsset.tedographyFilename,
        tedographyCaptureDateTime: tedographyAsset.tedographyCaptureDateTime ?? '',
        tedographyWidth: tedographyAsset.tedographyWidth?.toString() ?? '',
        tedographyHeight: tedographyAsset.tedographyHeight?.toString() ?? '',
        tedographyPhotoState: tedographyAsset.tedographyPhotoState ?? '',
        tedographyOriginalArchivePath: tedographyAsset.tedographyOriginalArchivePath ?? '',
        normalizedStem: tedographyAsset.normalizedStem
      });
      skippedRows.push(
        createSkippedRow(
          tedographyAsset.tedographyId,
          tedographyAsset.tedographyFilename,
          'no_match',
          tedographyAsset.tedographyCaptureEpochMs === null
            ? 'Tedography captureDateTime was missing or unparseable.'
            : 'No strict Shafferography candidate matched normalized stem, capture instant, and dimensions.'
        )
      );
    }

    const limitApplied = options.limit;
    const updatesToProcess =
      options.limit === null ? eligibleUpdates : eligibleUpdates.slice(0, options.limit);
    const skippedByLimit =
      options.limit === null ? [] : eligibleUpdates.slice(options.limit);

    for (const skipped of skippedByLimit) {
      skippedRows.push(
        createSkippedRow(
          skipped.tedographyAsset.tedographyId,
          skipped.tedographyAsset.tedographyFilename,
          'limit_excluded',
          `Eligible for update but excluded by --limit ${options.limit?.toString()}.`
        )
      );
    }

    if (options.apply) {
      console.log('photo-state migration apply mode enabled: Tedography writes are ON.');
    }

    for (const eligible of updatesToProcess) {
      if (!options.apply) {
        skippedRows.push(
          createSkippedRow(
            eligible.tedographyAsset.tedographyId,
            eligible.tedographyAsset.tedographyFilename,
            'dry_run_only',
            `Would update Tedography photoState from "${eligible.tedographyAsset.tedographyPhotoState ?? ''}" to "${eligible.proposedTedographyPhotoState}".`
          )
        );
        continue;
      }

      logVerbose(
        options.verbose,
        `Updating Tedography ${eligible.tedographyAsset.tedographyId}: ${eligible.tedographyAsset.tedographyPhotoState ?? ''} -> ${eligible.proposedTedographyPhotoState}`
      );

      const updateResult = await tedographyCollection.updateOne(
        { id: eligible.tedographyAsset.tedographyId },
        { $set: { photoState: eligible.proposedTedographyPhotoState } }
      );

      if (updateResult.matchedCount !== 1 || updateResult.modifiedCount !== 1) {
        skippedRows.push(
          createSkippedRow(
            eligible.tedographyAsset.tedographyId,
            eligible.tedographyAsset.tedographyFilename,
            'update_not_applied',
            `Expected one modified document, got matchedCount=${updateResult.matchedCount.toString()} modifiedCount=${updateResult.modifiedCount.toString()}.`
          )
        );
        continue;
      }

      const updatedAtIso = new Date().toISOString();
      updatedRows.push({
        tedographyId: eligible.tedographyAsset.tedographyId,
        tedographyFilename: eligible.tedographyAsset.tedographyFilename,
        tedographyOriginalArchivePath: eligible.tedographyAsset.tedographyOriginalArchivePath ?? '',
        tedographyOldPhotoState: eligible.tedographyAsset.tedographyPhotoState ?? '',
        tedographyNewPhotoState: eligible.proposedTedographyPhotoState,
        shafferographyUniqueId: eligible.match.shafferographyUniqueId,
        shafferographyFileName: eligible.match.shafferographyFileName,
        shafferographyPhotoState: eligible.match.shafferographyPhotoState ?? '',
        matchReason: eligible.matchReason,
        updatedAtIso
      });
    }

    notes.push(
      options.apply
        ? 'Tedography writes were enabled with --apply. Shafferography remained read-only.'
        : 'Dry run only. No writes were made to Tedography or Shafferography.',
      'Strict match rule: normalized filename stem + exact capture instant equality + exact dimensions when both sides have dimensions.',
      `Tedography collection: ${TEDOGRAPHY_COLLECTION_NAME}.`,
      `Shafferography collection: ${shafferographyCollectionName}.`
    );

    if (options.ids && options.ids.length > 0) {
      notes.push(`Restricted to ${options.ids.length.toString()} Tedography ids via --ids.`);
    }
    if (options.limit !== null) {
      notes.push(`Restricted eligible updates to the first ${options.limit.toString()} rows via --limit.`);
    }
    if (tedographySkippedMalformed > 0) {
      notes.push(`Skipped ${tedographySkippedMalformed.toString()} malformed Tedography rows missing a usable id.`);
    }
    if (shafferographySkippedMalformed > 0) {
      notes.push(
        `Skipped ${shafferographySkippedMalformed.toString()} malformed Shafferography rows missing a usable uniqueId.`
      );
    }
    if (tedographyMissingCapture > 0) {
      notes.push(
        `${tedographyMissingCapture.toString()} Tedography assets lacked a parseable captureDateTime, which prevents strict matching.`
      );
    }
    if (shafferographyMissingCapture > 0) {
      notes.push(
        `${shafferographyMissingCapture.toString()} Shafferography candidates lacked a parseable capture timestamp, which prevents strict matching.`
      );
    }

    const finishedAtIso = new Date().toISOString();
    const summary: SummaryReport = {
      mode: options.apply ? 'apply' : 'dry-run',
      tedographyAssetsScanned: tedographyAssets.length,
      shafferographyCandidatesScanned: shafferographyAssets.length,
      uniqueMatches: matchedRows.length,
      ambiguousMatches: ambiguousRows.length,
      unmatched: unmatchedRows.length,
      eligibleForUpdate: eligibleUpdates.length,
      updatedCount: updatedRows.length,
      noopCount: noopRows.length,
      skippedCount: skippedRows.length,
      limitApplied,
      startedAtIso,
      finishedAtIso,
      shafferographyStateCountsForMatches,
      proposedTedographyStateCounts,
      notes
    };

    await fs.mkdir(outputDirectory, { recursive: true });

    await Promise.all([
      fs.writeFile(
        path.join(outputDirectory, 'photo-state-migration__matched.csv'),
        writeCsv(matchedRows, [
          'tedographyId',
          'tedographyFilename',
          'proposedTedographyPhotoState',
          'shafferographyUniqueId',
          'shafferographyFileName',
          'shafferographyPhotoState',
          'matchReason',
          'tedographyCaptureDateTime',
          'tedographyWidth',
          'tedographyHeight',
          'tedographyOriginalArchivePath',
          'shafferographyCaptureTimeUsed',
          'shafferographyWidth',
          'shafferographyHeight',
          'shafferographyFilePath'
        ])
      ),
      fs.writeFile(
        path.join(outputDirectory, 'photo-state-migration__ambiguous.csv'),
        writeCsv(ambiguousRows, [
          'tedographyId',
          'tedographyFilename',
          'tedographyCaptureDateTime',
          'tedographyOriginalArchivePath',
          'candidateCount',
          'candidateSummaries'
        ])
      ),
      fs.writeFile(
        path.join(outputDirectory, 'photo-state-migration__unmatched.csv'),
        writeCsv(unmatchedRows, [
          'tedographyId',
          'tedographyFilename',
          'tedographyCaptureDateTime',
          'tedographyWidth',
          'tedographyHeight',
          'tedographyPhotoState',
          'tedographyOriginalArchivePath',
          'normalizedStem'
        ])
      ),
      fs.writeFile(
        path.join(outputDirectory, 'photo-state-migration__updated.csv'),
        writeCsv(updatedRows, [
          'tedographyId',
          'tedographyFilename',
          'tedographyOriginalArchivePath',
          'tedographyOldPhotoState',
          'tedographyNewPhotoState',
          'shafferographyUniqueId',
          'shafferographyFileName',
          'shafferographyPhotoState',
          'matchReason',
          'updatedAtIso'
        ])
      ),
      fs.writeFile(
        path.join(outputDirectory, 'photo-state-migration__noop.csv'),
        writeCsv(noopRows, [
          'tedographyId',
          'tedographyFilename',
          'tedographyPhotoState',
          'shafferographyUniqueId',
          'shafferographyPhotoState',
          'mappedTedographyPhotoState',
          'reason'
        ])
      ),
      fs.writeFile(
        path.join(outputDirectory, 'photo-state-migration__skipped.csv'),
        writeCsv(skippedRows, ['tedographyId', 'tedographyFilename', 'reason', 'details'])
      ),
      fs.writeFile(
        path.join(outputDirectory, 'photo-state-migration__summary.json'),
        `${JSON.stringify(summary, null, 2)}\n`
      )
    ]);

    console.log(
      [
        'photo-state migration complete',
        `mode: ${summary.mode}`,
        `tedography assets scanned: ${summary.tedographyAssetsScanned}`,
        `shafferography candidates scanned: ${summary.shafferographyCandidatesScanned}`,
        `unique matches: ${summary.uniqueMatches}`,
        `eligible updates: ${summary.eligibleForUpdate}`,
        `updated count: ${summary.updatedCount}`,
        `no-op count: ${summary.noopCount}`,
        `skipped count: ${summary.skippedCount}`,
        `ambiguous matches: ${summary.ambiguousMatches}`,
        `unmatched: ${summary.unmatched}`,
        `output: ${outputDirectory}`
      ].join('\n')
    );
  } finally {
    await tedographyClient.close();
    if (shafferographyClient !== tedographyClient) {
      await shafferographyClient.close();
    }
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`photo-state migration failed: ${message}`);
  process.exitCode = 1;
});
