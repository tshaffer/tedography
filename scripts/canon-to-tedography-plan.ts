import 'dotenv/config';

/**
 * canon-to-tedography-plan.ts
 *
 * Plans, and optionally materializes, a Tedography-importable copied tree for
 * Shafferography `source: "canon"` assets that currently live in canonical
 * by-hash storage.
 *
 * Default mode is plan-only:
 * - reads Shafferography `mediaitems`
 * - reads Takeout-processing CSV artifacts
 * - writes manifest/report outputs under `scripts/output`
 * - performs no filesystem copies unless `--apply` is present
 *
 * Usage:
 *   pnpm canon-import-plan --destination-root <DEST_ROOT> --manifests-root <MANIFESTS_ROOT>
 *
 *   or:
 *
 *   pnpm canon-import-plan --destination-root <DEST_ROOT> \
 *     --dedup-plan <PATH_TO_dedup_plan__unique.csv> \
 *     --already-in-canon <PATH_TO_already_in_canon.csv> \
 *     --canonical-inventory <PATH_TO_canonical_inventory__by-hash.csv>
 *
 * Required config:
 *   --destination-root <path>
 *   --shafferography-uri <mongodb-uri>
 *   and either:
 *     --manifests-root <path>
 *   or:
 *     --dedup-plan <path>
 *     --already-in-canon <path>
 *     --canonical-inventory <path>
 *
 * Environment variable equivalents:
 *   SHAFFEROGRAPHY_MONGODB_URI
 *   CANON_TO_TEDOGRAPHY_DEST_ROOT
 *   CANON_TO_TEDOGRAPHY_MANIFESTS_ROOT
 *   CANON_TO_TEDOGRAPHY_DEDUP_PLAN_CSV
 *   CANON_TO_TEDOGRAPHY_ALREADY_IN_CANON_CSV
 *   CANON_TO_TEDOGRAPHY_CANONICAL_INVENTORY_CSV
 *   SHAFFEROGRAPHY_DB_NAME
 *   SHAFFEROGRAPHY_MEDIA_COLLECTION
 *
 * Optional flags:
 *   --apply
 *   --limit <N>
 *   --verbose
 *   --output-dir <path>
 *
 * Example run:
 *   SHAFFEROGRAPHY_MONGODB_URI="mongodb://localhost:27017" \
 *   CANON_TO_TEDOGRAPHY_DEST_ROOT="/Volumes/ShMedia/TedographyImportStaging" \
 *   CANON_TO_TEDOGRAPHY_MANIFESTS_ROOT="/Volumes/ShMedia/MANIFESTS" \
 *   pnpm canon-import-plan --limit 100 --verbose
 *
 * Example apply run:
 *   SHAFFEROGRAPHY_MONGODB_URI="mongodb://localhost:27017" \
 *   CANON_TO_TEDOGRAPHY_DEST_ROOT="/Volumes/ShMedia/TedographyImportStaging" \
 *   CANON_TO_TEDOGRAPHY_DEDUP_PLAN_CSV="/path/to/dedup_plan__unique.csv" \
 *   CANON_TO_TEDOGRAPHY_ALREADY_IN_CANON_CSV="/path/to/already_in_canon.csv" \
 *   CANON_TO_TEDOGRAPHY_CANONICAL_INVENTORY_CSV="/path/to/canonical_inventory__by-hash.csv" \
 *   pnpm canon-import-plan --apply --limit 25 --verbose
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';

interface CliOptions {
  apply: boolean;
  limit: number | null;
  verbose: boolean;
  shafferographyUri: string | null;
  destinationRoot: string | null;
  manifestsRoot: string | null;
  dedupPlanCsvPath: string | null;
  alreadyInCanonCsvPath: string | null;
  canonicalInventoryCsvPath: string | null;
  outputDirectory: string | null;
}

interface ScriptConfig {
  apply: boolean;
  limit: number | null;
  verbose: boolean;
  shafferographyUri: string;
  shafferographyDbName: string;
  shafferographyCollectionName: string;
  destinationRoot: string;
  manifestsRoot: string | null;
  dedupPlanCsvPaths: string[];
  alreadyInCanonCsvPaths: string[];
  canonicalInventoryCsvPaths: string[];
  outputDirectory: string;
}

interface ShafferographyMediaItemDocument {
  uniqueId?: unknown;
  source?: unknown;
  contentHash?: unknown;
  filePath?: unknown;
  fileName?: unknown;
  mimeType?: unknown;
  googleAlbumName?: unknown;
  googleTakenAtIso?: unknown;
  creationTime?: unknown;
  lastModified?: unknown;
}

interface ParsedCsv {
  filePath: string;
  headers: string[];
  rows: CsvRow[];
}

interface CsvRow {
  lineNumber: number;
  values: Record<string, string>;
}

type ArtifactSourceLabel = 'dedup_plan__unique' | 'already_in_canon' | 'fallback_inventory';

interface ArtifactRecord {
  sourceLabel: ArtifactSourceLabel;
  sha256: string;
  relativePath: string | null;
  absPath: string | null;
  extension: string | null;
  artifactFilePath: string;
  artifactManifestFolder: string;
  lineNumber: number;
}

interface ArtifactFileLoadResult {
  parsedCsv: ParsedCsv;
  indexedRecords: Map<string, ArtifactRecord[]>;
  schemaNotes: string[];
}

interface AggregatedArtifactLoadResult {
  filePaths: string[];
  indexedRecords: Map<string, ArtifactRecord[]>;
  schemaNotes: string[];
}

interface PlanningRow {
  uniqueId: string;
  contentHash: string;
  canonSourcePath: string;
  shafferographyFileName: string;
  matchedArtifactSource: string;
  artifactRelativePath: string;
  artifactFilePath: string;
  artifactManifestFolder: string;
  googleAlbumName: string;
  chosenYear: string;
  chosenBaseFileName: string;
  finalFileName: string;
  destinationFolder: string;
  destinationPath: string;
  collisionApplied: string;
  collisionReason: string;
  copyAction: 'planned';
}

interface PlannedCopyRecord {
  planRow: PlanningRow;
  destinationPathBeforeCollisionResolution: string;
}

interface UnmatchedCsvRow {
  uniqueId: string;
  contentHash: string;
  canonSourcePath: string;
  shafferographyFileName: string;
  googleAlbumName: string;
  googleTakenAtIso: string;
  artifactLookupSummary: string;
  reason: string;
}

interface CollisionsCsvRow {
  destinationPathBeforeCollisionResolution: string;
  contentHash: string;
  canonSourcePath: string;
  finalResolvedDestinationPath: string;
  collisionGroupSize: string;
}

interface CopiedCsvRow {
  uniqueId: string;
  contentHash: string;
  canonSourcePath: string;
  destinationPath: string;
  copyStatus: string;
}

interface CopyFailureCsvRow {
  uniqueId: string;
  contentHash: string;
  canonSourcePath: string;
  destinationPath: string;
  reason: string;
  details: string;
}

interface SummaryReport {
  canonItemsRead: number;
  matchedViaDedupPlanUnique: number;
  matchedViaAlreadyInCanon: number;
  unmatched: number;
  collisionCount: number;
  rowsPlanned: number;
  destinationRoot: string;
  dedupPlanFilesLoaded: number;
  alreadyInCanonFilesLoaded: number;
  canonicalInventoryFilesLoaded: number;
  notes: string[];
}

interface PlanningCandidate {
  uniqueId: string;
  contentHash: string;
  canonSourcePath: string;
  shafferographyFileName: string;
  matchedArtifactSource: string;
  artifactRelativePath: string;
  artifactFilePath: string;
  artifactManifestFolder: string;
  googleAlbumName: string;
  googleTakenAtIso: string;
  chosenYear: string;
  chosenBaseFileName: string;
  destinationFolder: string;
  destinationPathBeforeCollisionResolution: string;
}

const DEFAULT_SHAFFEROGRAPHY_DB_NAME = 'pgPhotos';
const DEFAULT_SHAFFEROGRAPHY_COLLECTION_NAME = 'mediaitems';
const DEFAULT_OUTPUT_DIRECTORY = path.resolve(process.cwd(), 'scripts/output');
const HASH_SUFFIX_LENGTH = 8;
const MAX_FILESYSTEM_SEGMENT_LENGTH = 180;

const mimeTypeExtensionMap = new Map<string, string>([
  ['image/heic', '.heic'],
  ['image/heif', '.heif'],
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/tiff', '.tif'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif'],
  ['video/mp4', '.mp4'],
  ['video/quicktime', '.mov'],
  ['video/x-msvideo', '.avi']
]);

function parseCliOptions(argv: string[]): CliOptions {
  let apply = false;
  let limit: number | null = null;
  let verbose = false;
  let shafferographyUri: string | null = null;
  let destinationRoot: string | null = null;
  let manifestsRoot: string | null = null;
  let dedupPlanCsvPath: string | null = null;
  let alreadyInCanonCsvPath: string | null = null;
  let canonicalInventoryCsvPath: string | null = null;
  let outputDirectory: string | null = null;

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
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Expected a numeric value after --limit.');
      }

      const parsed = Number.parseInt(value, 10);
      if (!Number.isInteger(parsed) || parsed < 0) {
        throw new Error(`Invalid --limit value: ${value}`);
      }

      limit = parsed;
      index += 1;
      continue;
    }

    if (argument === '--shafferography-uri') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Expected a MongoDB URI after --shafferography-uri.');
      }

      shafferographyUri = value;
      index += 1;
      continue;
    }

    if (argument === '--destination-root') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Expected a path after --destination-root.');
      }

      destinationRoot = value;
      index += 1;
      continue;
    }

    if (argument === '--manifests-root') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Expected a path after --manifests-root.');
      }

      manifestsRoot = value;
      index += 1;
      continue;
    }

    if (argument === '--dedup-plan') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Expected a path after --dedup-plan.');
      }

      dedupPlanCsvPath = value;
      index += 1;
      continue;
    }

    if (argument === '--already-in-canon') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Expected a path after --already-in-canon.');
      }

      alreadyInCanonCsvPath = value;
      index += 1;
      continue;
    }

    if (argument === '--canonical-inventory') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Expected a path after --canonical-inventory.');
      }

      canonicalInventoryCsvPath = value;
      index += 1;
      continue;
    }

    if (argument === '--output-dir') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Expected a path after --output-dir.');
      }

      outputDirectory = value;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  return {
    apply,
    limit,
    verbose,
    shafferographyUri,
    destinationRoot,
    manifestsRoot,
    dedupPlanCsvPath,
    alreadyInCanonCsvPath,
    canonicalInventoryCsvPath,
    outputDirectory
  };
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function normalizeHash(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return /^[a-f0-9]{64}$/.test(normalized) ? normalized : null;
}

function normalizeExtension(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const withDot = trimmed.startsWith('.') ? trimmed : `.${trimmed}`;
  return withDot.toLowerCase();
}

function normalizeHeaderName(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function logVerbose(enabled: boolean, message: string): void {
  if (enabled) {
    console.log(message);
  }
}

function getRequiredConfig(cliOptions: CliOptions): ScriptConfig {
  const shafferographyUri =
    cliOptions.shafferographyUri?.trim() ||
    process.env.SHAFFEROGRAPHY_MONGODB_URI?.trim() ||
    process.env.MONGODB_URI?.trim();
  const destinationRoot =
    cliOptions.destinationRoot?.trim() || process.env.CANON_TO_TEDOGRAPHY_DEST_ROOT?.trim();
  const manifestsRoot =
    cliOptions.manifestsRoot?.trim() || process.env.CANON_TO_TEDOGRAPHY_MANIFESTS_ROOT?.trim();
  const dedupPlanCsvPath =
    cliOptions.dedupPlanCsvPath?.trim() || process.env.CANON_TO_TEDOGRAPHY_DEDUP_PLAN_CSV?.trim();
  const alreadyInCanonCsvPath =
    cliOptions.alreadyInCanonCsvPath?.trim() ||
    process.env.CANON_TO_TEDOGRAPHY_ALREADY_IN_CANON_CSV?.trim();
  const canonicalInventoryCsvPath =
    cliOptions.canonicalInventoryCsvPath?.trim() ||
    process.env.CANON_TO_TEDOGRAPHY_CANONICAL_INVENTORY_CSV?.trim();

  if (!shafferographyUri) {
    throw new Error('Set --shafferography-uri or SHAFFEROGRAPHY_MONGODB_URI/MONGODB_URI.');
  }

  if (!destinationRoot) {
    throw new Error('Set --destination-root or CANON_TO_TEDOGRAPHY_DEST_ROOT.');
  }

  const usingManifestsRoot = Boolean(manifestsRoot);

  if (
    !usingManifestsRoot &&
    (!dedupPlanCsvPath || !alreadyInCanonCsvPath || !canonicalInventoryCsvPath)
  ) {
    throw new Error(
      'Set --manifests-root or all of --dedup-plan, --already-in-canon, and --canonical-inventory (or their CANON_TO_TEDOGRAPHY_* env vars).'
    );
  }

  return {
    apply: cliOptions.apply,
    limit: cliOptions.limit,
    verbose: cliOptions.verbose,
    shafferographyUri,
    shafferographyDbName:
      process.env.SHAFFEROGRAPHY_DB_NAME?.trim() || DEFAULT_SHAFFEROGRAPHY_DB_NAME,
    shafferographyCollectionName:
      process.env.SHAFFEROGRAPHY_MEDIA_COLLECTION?.trim() || DEFAULT_SHAFFEROGRAPHY_COLLECTION_NAME,
    destinationRoot: path.resolve(destinationRoot),
    manifestsRoot: manifestsRoot ? path.resolve(manifestsRoot) : null,
    dedupPlanCsvPaths: usingManifestsRoot || !dedupPlanCsvPath ? [] : [path.resolve(dedupPlanCsvPath)],
    alreadyInCanonCsvPaths:
      usingManifestsRoot || !alreadyInCanonCsvPath ? [] : [path.resolve(alreadyInCanonCsvPath)],
    canonicalInventoryCsvPaths:
      usingManifestsRoot || !canonicalInventoryCsvPath ? [] : [path.resolve(canonicalInventoryCsvPath)],
    outputDirectory: path.resolve(cliOptions.outputDirectory?.trim() || DEFAULT_OUTPUT_DIRECTORY)
  };
}

function parseCsv(content: string): ParsedCsv {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];

    if (inQuotes) {
      if (character === '"') {
        if (content[index + 1] === '"') {
          currentField += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        currentField += character;
      }
      continue;
    }

    if (character === '"') {
      inQuotes = true;
      continue;
    }

    if (character === ',') {
      currentRow.push(currentField);
      currentField = '';
      continue;
    }

    if (character === '\n') {
      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = [];
      currentField = '';
      continue;
    }

    if (character === '\r') {
      continue;
    }

    currentField += character;
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  const nonEmptyRows = rows.filter((row) => row.some((value) => value.length > 0));
  if (nonEmptyRows.length === 0) {
    return { filePath: '', headers: [], rows: [] };
  }

  const headers = nonEmptyRows[0].map((header) => header.trim());
  const parsedRows: CsvRow[] = nonEmptyRows.slice(1).map((row, rowIndex) => {
    const values: Record<string, string> = {};
    for (let columnIndex = 0; columnIndex < headers.length; columnIndex += 1) {
      values[headers[columnIndex]] = row[columnIndex] ?? '';
    }

    return {
      lineNumber: rowIndex + 2,
      values
    };
  });

  return {
    filePath: '',
    headers,
    rows: parsedRows
  };
}

function resolveHeaderKey(headers: string[], aliases: string[]): string | null {
  const normalizedHeaders = new Map(headers.map((header) => [normalizeHeaderName(header), header]));

  for (const alias of aliases) {
    const resolved = normalizedHeaders.get(normalizeHeaderName(alias));
    if (resolved) {
      return resolved;
    }
  }

  return null;
}

async function discoverManifestArtifactFiles(
  manifestsRoot: string
): Promise<{
  dedupPlanCsvPaths: string[];
  alreadyInCanonCsvPaths: string[];
  canonicalInventoryCsvPaths: string[];
}> {
  const dedupPlanCsvPaths: string[] = [];
  const alreadyInCanonCsvPaths: string[] = [];
  const canonicalInventoryCsvPaths: string[] = [];

  async function walk(currentPath: string): Promise<void> {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    const sortedEntries = [...entries].sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of sortedEntries) {
      const nextPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        await walk(nextPath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      if (entry.name === 'dedup_plan__unique.csv') {
        dedupPlanCsvPaths.push(nextPath);
        continue;
      }

      if (entry.name === 'already_in_canon.csv') {
        alreadyInCanonCsvPaths.push(nextPath);
        continue;
      }

      if (entry.name === 'canonical_inventory__by-hash.csv') {
        canonicalInventoryCsvPaths.push(nextPath);
      }
    }
  }

  await walk(manifestsRoot);

  return {
    dedupPlanCsvPaths,
    alreadyInCanonCsvPaths,
    canonicalInventoryCsvPaths
  };
}

async function loadArtifactFile(
  filePath: string,
  sourceLabel: ArtifactSourceLabel
): Promise<ArtifactFileLoadResult> {
  const content = await fs.readFile(filePath, 'utf8');
  const parsedCsv = parseCsv(content);
  parsedCsv.filePath = filePath;

  const sha256Key = resolveHeaderKey(parsedCsv.headers, [
    'sha256',
    'sha_256',
    'contentHash',
    'content_hash',
    'hash'
  ]);
  const relativePathKey = resolveHeaderKey(parsedCsv.headers, [
    'relativePath',
    'relative_path',
    'originalRelativePath',
    'sourceRelativePath',
    'path'
  ]);
  const absPathKey = resolveHeaderKey(parsedCsv.headers, [
    'absPath',
    'absolutePath',
    'absolute_path',
    'canonicalAbsPath',
    'sourceAbsPath',
    'filePath'
  ]);
  const extensionKey = resolveHeaderKey(parsedCsv.headers, ['extension', 'ext', 'suffix']);

  const schemaNotes = [
    `${path.basename(filePath)} sha256=${sha256Key ?? '(missing)'}`,
    `${path.basename(filePath)} relativePath=${relativePathKey ?? '(missing)'}`,
    `${path.basename(filePath)} absPath=${absPathKey ?? '(missing)'}`,
    `${path.basename(filePath)} extension=${extensionKey ?? '(missing)'}`
  ];

  if (!sha256Key) {
    throw new Error(`Could not resolve a sha256/content hash column in ${filePath}.`);
  }

  const indexedRecords = new Map<string, ArtifactRecord[]>();

  for (const row of parsedCsv.rows) {
    const sha256 = normalizeHash(asString(row.values[sha256Key]));
    if (!sha256) {
      continue;
    }

    const relativePath = relativePathKey ? asString(row.values[relativePathKey]) : null;
    const absPath = absPathKey ? asString(row.values[absPathKey]) : null;
    const extension =
      normalizeExtension(extensionKey ? asString(row.values[extensionKey]) : null) ??
      normalizeExtension(path.extname(relativePath ?? absPath ?? ''));

    const record: ArtifactRecord = {
      sourceLabel,
      sha256,
      relativePath,
      absPath,
      extension,
      artifactFilePath: filePath,
      artifactManifestFolder: path.basename(path.dirname(filePath)),
      lineNumber: row.lineNumber
    };

    const existing = indexedRecords.get(sha256) ?? [];
    existing.push(record);
    indexedRecords.set(sha256, existing);
  }

  return {
    parsedCsv,
    indexedRecords,
    schemaNotes
  };
}

async function loadArtifactFiles(
  filePaths: string[],
  sourceLabel: ArtifactSourceLabel
): Promise<AggregatedArtifactLoadResult> {
  const indexedRecords = new Map<string, ArtifactRecord[]>();
  const schemaNotes: string[] = [];

  for (const filePath of [...filePaths].sort((left, right) => left.localeCompare(right))) {
    const loaded = await loadArtifactFile(filePath, sourceLabel);
    schemaNotes.push(...loaded.schemaNotes);

    for (const [sha256, records] of loaded.indexedRecords) {
      const existing = indexedRecords.get(sha256) ?? [];
      existing.push(...records);
      indexedRecords.set(sha256, existing);
    }
  }

  return {
    filePaths: [...filePaths].sort((left, right) => left.localeCompare(right)),
    indexedRecords,
    schemaNotes
  };
}

function chooseArtifactRecord(records: ArtifactRecord[] | undefined): ArtifactRecord | null {
  if (!records || records.length === 0) {
    return null;
  }

  return [...records].sort((left, right) => {
    const leftHasRelativePath = left.relativePath ? 1 : 0;
    const rightHasRelativePath = right.relativePath ? 1 : 0;
    if (leftHasRelativePath !== rightHasRelativePath) {
      return rightHasRelativePath - leftHasRelativePath;
    }

    if (left.artifactManifestFolder !== right.artifactManifestFolder) {
      return left.artifactManifestFolder.localeCompare(right.artifactManifestFolder, undefined, {
        numeric: true,
        sensitivity: 'base'
      });
    }

    if (left.artifactFilePath !== right.artifactFilePath) {
      return left.artifactFilePath.localeCompare(right.artifactFilePath, undefined, {
        numeric: true,
        sensitivity: 'base'
      });
    }

    if ((left.relativePath ?? '') !== (right.relativePath ?? '')) {
      return (left.relativePath ?? '').localeCompare(right.relativePath ?? '', undefined, {
        numeric: true,
        sensitivity: 'base'
      });
    }

    return left.lineNumber - right.lineNumber;
  })[0];
}

function getBasenameFromPath(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const basename = path.basename(value);
  return basename.length > 0 ? basename : null;
}

function sanitizeFilesystemSegment(value: string): string {
  const normalized = value
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '');

  if (normalized.length === 0) {
    return 'Untitled';
  }

  return normalized.slice(0, MAX_FILESYSTEM_SEGMENT_LENGTH);
}

function sanitizeFilename(filename: string): string {
  const extension = path.extname(filename);
  const stem = extension.length > 0 ? filename.slice(0, -extension.length) : filename;
  const sanitizedStem = sanitizeFilesystemSegment(stem);
  const normalizedExtension = extension.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').trim();

  if (normalizedExtension.length === 0) {
    return sanitizedStem;
  }

  return `${sanitizedStem}${normalizedExtension}`;
}

function derivePreferredExtension(input: {
  canonSourcePath: string | null;
  preferredFilename: string | null;
  fallbackFilename: string | null;
  artifactExtension: string | null;
  mimeType: string | null;
}): string | null {
  return (
    normalizeExtension(path.extname(input.canonSourcePath ?? '')) ??
    normalizeExtension(path.extname(input.preferredFilename ?? '')) ??
    normalizeExtension(path.extname(input.fallbackFilename ?? '')) ??
    input.artifactExtension ??
    normalizeExtension(mimeTypeExtensionMap.get((input.mimeType ?? '').toLowerCase()) ?? null)
  );
}

function chooseBaseFilename(input: {
  preferredFilename: string | null;
  fallbackFilename: string | null;
  contentHash: string;
  preferredExtension: string | null;
}): string {
  const candidates = [input.preferredFilename, input.fallbackFilename]
    .map((value) => getBasenameFromPath(value))
    .filter((value): value is string => value !== null);

  for (const candidate of candidates) {
    const candidateExtension = normalizeExtension(path.extname(candidate));
    const stem = candidateExtension ? candidate.slice(0, -candidateExtension.length) : candidate;
    const finalExtension = input.preferredExtension ?? candidateExtension;
    const finalName = finalExtension ? `${stem}${finalExtension}` : stem;
    const sanitized = sanitizeFilename(finalName);
    if (sanitized.length > 0) {
      return sanitized;
    }
  }

  const hashName = input.preferredExtension ? `${input.contentHash}${input.preferredExtension}` : input.contentHash;
  return sanitizeFilename(hashName);
}

function chooseYear(googleTakenAtIso: string | null, creationTime: string | null): string {
  for (const value of [googleTakenAtIso, creationTime]) {
    if (!value) {
      continue;
    }

    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return String(parsed.getUTCFullYear());
    }
  }

  return 'Unknown Year';
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

function addHashSuffix(filename: string, hash: string, ordinal: number | null = null): string {
  const extension = path.extname(filename);
  const stem = extension.length > 0 ? filename.slice(0, -extension.length) : filename;
  const hashSuffix = hash.slice(0, HASH_SUFFIX_LENGTH);
  const ordinalSuffix = ordinal !== null ? `__${String(ordinal).padStart(2, '0')}` : '';
  return `${stem}__${hashSuffix}${ordinalSuffix}${extension}`;
}

function resolveDestinationCollisions(planningCandidates: PlanningCandidate[]): {
  plannedCopyRecords: PlannedCopyRecord[];
  collisionsRows: CollisionsCsvRow[];
} {
  const grouped = new Map<string, PlanningCandidate[]>();

  for (const candidate of planningCandidates) {
    const key = candidate.destinationPathBeforeCollisionResolution.toLowerCase();
    const existing = grouped.get(key) ?? [];
    existing.push(candidate);
    grouped.set(key, existing);
  }

  const plannedCopyRecords: PlannedCopyRecord[] = [];
  const collisionsRows: CollisionsCsvRow[] = [];

  for (const group of grouped.values()) {
    const sortedGroup = [...group].sort((left, right) => {
      if (left.contentHash !== right.contentHash) {
        return left.contentHash.localeCompare(right.contentHash);
      }

      return left.uniqueId.localeCompare(right.uniqueId);
    });
    const usedPaths = new Set<string>();

    for (let index = 0; index < sortedGroup.length; index += 1) {
      const candidate = sortedGroup[index];
      let finalFileName = candidate.chosenBaseFileName;
      let finalDestinationPath = candidate.destinationPathBeforeCollisionResolution;
      let collisionApplied = false;
      let collisionReason = '';

      if (sortedGroup.length > 1) {
        collisionReason = `shared destination with ${String(sortedGroup.length)} planned rows`;
      }

      if (usedPaths.has(finalDestinationPath.toLowerCase())) {
        collisionApplied = true;
      }

      if (collisionApplied) {
        let ordinal = 0;
        while (true) {
          finalFileName = addHashSuffix(
            candidate.chosenBaseFileName,
            candidate.contentHash,
            ordinal === 0 ? null : ordinal + 1
          );
          finalDestinationPath = path.join(candidate.destinationFolder, finalFileName);
          if (!usedPaths.has(finalDestinationPath.toLowerCase())) {
            break;
          }
          ordinal += 1;
        }
      }

      usedPaths.add(finalDestinationPath.toLowerCase());

      const planRow: PlanningRow = {
        uniqueId: candidate.uniqueId,
        contentHash: candidate.contentHash,
        canonSourcePath: candidate.canonSourcePath,
        shafferographyFileName: candidate.shafferographyFileName,
        matchedArtifactSource: candidate.matchedArtifactSource,
        artifactRelativePath: candidate.artifactRelativePath,
        artifactFilePath: candidate.artifactFilePath,
        artifactManifestFolder: candidate.artifactManifestFolder,
        googleAlbumName: candidate.googleAlbumName,
        chosenYear: candidate.chosenYear,
        chosenBaseFileName: candidate.chosenBaseFileName,
        finalFileName,
        destinationFolder: candidate.destinationFolder,
        destinationPath: finalDestinationPath,
        collisionApplied: collisionApplied ? 'true' : 'false',
        collisionReason,
        copyAction: 'planned'
      };

      plannedCopyRecords.push({
        planRow,
        destinationPathBeforeCollisionResolution: candidate.destinationPathBeforeCollisionResolution
      });

      if (sortedGroup.length > 1) {
        collisionsRows.push({
          destinationPathBeforeCollisionResolution: candidate.destinationPathBeforeCollisionResolution,
          contentHash: candidate.contentHash,
          canonSourcePath: candidate.canonSourcePath,
          finalResolvedDestinationPath: finalDestinationPath,
          collisionGroupSize: String(sortedGroup.length)
        });
      }
    }
  }

  return { plannedCopyRecords, collisionsRows };
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function performCopyPlan(plannedRows: PlanningRow[]): Promise<{
  copiedRows: CopiedCsvRow[];
  copyFailureRows: CopyFailureCsvRow[];
}> {
  const copiedRows: CopiedCsvRow[] = [];
  const copyFailureRows: CopyFailureCsvRow[] = [];

  for (const row of plannedRows) {
    try {
      const sourceExists = await pathExists(row.canonSourcePath);
      if (!sourceExists) {
        copyFailureRows.push({
          uniqueId: row.uniqueId,
          contentHash: row.contentHash,
          canonSourcePath: row.canonSourcePath,
          destinationPath: row.destinationPath,
          reason: 'missing_source_file',
          details: 'Source file does not exist.'
        });
        continue;
      }

      await fs.mkdir(path.dirname(row.destinationPath), { recursive: true });

      const destinationExists = await pathExists(row.destinationPath);
      if (destinationExists) {
        const [sourceStat, destinationStat] = await Promise.all([
          fs.stat(row.canonSourcePath),
          fs.stat(row.destinationPath)
        ]);

        if (sourceStat.size === destinationStat.size) {
          copiedRows.push({
            uniqueId: row.uniqueId,
            contentHash: row.contentHash,
            canonSourcePath: row.canonSourcePath,
            destinationPath: row.destinationPath,
            copyStatus: 'skipped_existing_identical'
          });
          continue;
        }

        copyFailureRows.push({
          uniqueId: row.uniqueId,
          contentHash: row.contentHash,
          canonSourcePath: row.canonSourcePath,
          destinationPath: row.destinationPath,
          reason: 'destination_exists_different',
          details: 'Destination exists with a different file size.'
        });
        continue;
      }

      await fs.copyFile(row.canonSourcePath, row.destinationPath);
      copiedRows.push({
        uniqueId: row.uniqueId,
        contentHash: row.contentHash,
        canonSourcePath: row.canonSourcePath,
        destinationPath: row.destinationPath,
        copyStatus: 'copied'
      });
    } catch (error) {
      copyFailureRows.push({
        uniqueId: row.uniqueId,
        contentHash: row.contentHash,
        canonSourcePath: row.canonSourcePath,
        destinationPath: row.destinationPath,
        reason: 'copy_error',
        details: error instanceof Error ? error.message : 'Unknown copy error.'
      });
    }
  }

  return { copiedRows, copyFailureRows };
}

async function main(): Promise<void> {
  const cliOptions = parseCliOptions(process.argv.slice(2));
  const config = getRequiredConfig(cliOptions);
  const notes: string[] = [];

  let dedupPlanCsvPaths = config.dedupPlanCsvPaths;
  let alreadyInCanonCsvPaths = config.alreadyInCanonCsvPaths;
  let canonicalInventoryCsvPaths = config.canonicalInventoryCsvPaths;

  if (config.manifestsRoot) {
    const discovered = await discoverManifestArtifactFiles(config.manifestsRoot);
    dedupPlanCsvPaths = discovered.dedupPlanCsvPaths;
    alreadyInCanonCsvPaths = discovered.alreadyInCanonCsvPaths;
    canonicalInventoryCsvPaths = discovered.canonicalInventoryCsvPaths;
    notes.push(`Using manifests root discovery from ${config.manifestsRoot}.`);
    notes.push('When --manifests-root is provided, it takes precedence over explicit single-file artifact arguments.');
  } else {
    notes.push('Using explicit single-file artifact inputs.');
  }

  logVerbose(config.verbose, `Loading ${dedupPlanCsvPaths.length} dedup_plan__unique artifact file(s).`);
  const dedupPlanArtifacts = await loadArtifactFiles(dedupPlanCsvPaths, 'dedup_plan__unique');
  logVerbose(config.verbose, `Loading ${alreadyInCanonCsvPaths.length} already_in_canon artifact file(s).`);
  const alreadyInCanonArtifacts = await loadArtifactFiles(
    alreadyInCanonCsvPaths,
    'already_in_canon'
  );
  logVerbose(config.verbose, `Loading ${canonicalInventoryCsvPaths.length} canonical inventory artifact file(s).`);
  const canonicalInventoryArtifacts = await loadArtifactFiles(
    canonicalInventoryCsvPaths,
    'fallback_inventory'
  );

  notes.push(...dedupPlanArtifacts.schemaNotes, ...alreadyInCanonArtifacts.schemaNotes, ...canonicalInventoryArtifacts.schemaNotes);
  notes.push(
    'Artifact selection tie-break rule: prefer usable relativePath, then manifest folder name, then artifact file path, then relativePath text, then CSV line number.'
  );
  notes.push(
    'Filename rule: artifact basename preferred, else Shafferography fileName, else content hash. If basename extension disagrees with the source file extension, keep the basename stem and use the source-file extension.'
  );
  notes.push(
    'Folder rule: Collections/By Date/<YEAR>/<GOOGLE_ALBUM_NAME>, using googleTakenAtIso first for year, then creationTime, else Unknown Year.'
  );
  notes.push('Collision rule: first planned destination keeps the plain name; later conflicts get a deterministic hash suffix.');

  const mongoClient = new mongoose.mongo.MongoClient(config.shafferographyUri);
  const unmatchedRows: UnmatchedCsvRow[] = [];
  const planningCandidates: PlanningCandidate[] = [];
  let canonItemsRead = 0;
  let matchedViaDedupPlanUnique = 0;
  let matchedViaAlreadyInCanon = 0;

  try {
    await mongoClient.connect();
    const collection = mongoClient
      .db(config.shafferographyDbName)
      .collection<ShafferographyMediaItemDocument>(config.shafferographyCollectionName);

    const documents = await collection
      .find(
        { source: 'canon' },
        {
          projection: {
            _id: 0,
            uniqueId: 1,
            source: 1,
            contentHash: 1,
            filePath: 1,
            fileName: 1,
            mimeType: 1,
            googleAlbumName: 1,
            googleTakenAtIso: 1,
            creationTime: 1,
            lastModified: 1
          },
          sort: { uniqueId: 1 },
          ...(config.limit !== null ? { limit: config.limit } : {})
        }
      )
      .toArray();

    canonItemsRead = documents.length;

    for (const document of documents) {
      const uniqueId = asString(document.uniqueId) ?? '';
      const contentHash = normalizeHash(asString(document.contentHash));
      const shafferographyFileName = asString(document.fileName) ?? '';
      const googleAlbumNameRaw = asString(document.googleAlbumName);
      const googleTakenAtIso = asString(document.googleTakenAtIso) ?? '';
      const creationTime = asString(document.creationTime);

      if (!uniqueId) {
        unmatchedRows.push({
          uniqueId: '',
          contentHash: contentHash ?? '',
          canonSourcePath: asString(document.filePath) ?? '',
          shafferographyFileName,
          googleAlbumName: googleAlbumNameRaw ?? '',
          googleTakenAtIso,
          artifactLookupSummary: '',
          reason: 'missing_unique_id'
        });
        continue;
      }

      if (!contentHash) {
        unmatchedRows.push({
          uniqueId,
          contentHash: '',
          canonSourcePath: asString(document.filePath) ?? '',
          shafferographyFileName,
          googleAlbumName: googleAlbumNameRaw ?? '',
          googleTakenAtIso,
          artifactLookupSummary: '',
          reason: 'missing_or_invalid_content_hash'
        });
        continue;
      }

      const dedupPlanMatches = dedupPlanArtifacts.indexedRecords.get(contentHash) ?? [];
      const alreadyInCanonMatches = alreadyInCanonArtifacts.indexedRecords.get(contentHash) ?? [];
      const canonicalInventoryMatches = canonicalInventoryArtifacts.indexedRecords.get(contentHash) ?? [];
      const preferredArtifact =
        chooseArtifactRecord(dedupPlanMatches) ?? chooseArtifactRecord(alreadyInCanonMatches);
      const inventoryArtifact = chooseArtifactRecord(canonicalInventoryMatches);
      const artifactLookupSummary = [
        `dedup_plan__unique=${dedupPlanMatches.length}`,
        `already_in_canon=${alreadyInCanonMatches.length}`,
        `canonical_inventory__by-hash=${canonicalInventoryMatches.length}`
      ].join(' | ');

      let matchedArtifactSource = 'none';
      if (preferredArtifact?.sourceLabel === 'dedup_plan__unique') {
        matchedArtifactSource = 'dedup_plan__unique';
        matchedViaDedupPlanUnique += 1;
      } else if (preferredArtifact?.sourceLabel === 'already_in_canon') {
        matchedArtifactSource = 'already_in_canon';
        matchedViaAlreadyInCanon += 1;
      } else if (inventoryArtifact) {
        matchedArtifactSource = 'fallback_inventory';
      }

      const artifactRecord = preferredArtifact ?? inventoryArtifact;
      const canonSourcePath =
        asString(document.filePath) ?? artifactRecord?.absPath ?? inventoryArtifact?.absPath ?? null;

      if (!canonSourcePath) {
        unmatchedRows.push({
          uniqueId,
          contentHash,
          canonSourcePath: '',
          shafferographyFileName,
          googleAlbumName: googleAlbumNameRaw ?? '',
          googleTakenAtIso,
          artifactLookupSummary,
          reason: 'missing_canon_source_path'
        });
        continue;
      }

      const preferredFilename =
        getBasenameFromPath(artifactRecord?.relativePath ?? null) ??
        getBasenameFromPath(artifactRecord?.absPath ?? null);
      const preferredExtension = derivePreferredExtension({
        canonSourcePath,
        preferredFilename,
        fallbackFilename: shafferographyFileName,
        artifactExtension: artifactRecord?.extension ?? inventoryArtifact?.extension ?? null,
        mimeType: asString(document.mimeType)
      });
      const chosenBaseFileName = chooseBaseFilename({
        preferredFilename,
        fallbackFilename: shafferographyFileName,
        contentHash,
        preferredExtension
      });
      const chosenYear = chooseYear(asString(document.googleTakenAtIso), creationTime);
      const googleAlbumName =
        sanitizeFilesystemSegment(googleAlbumNameRaw ?? 'Unknown Collection');
      const destinationFolder = path.join(
        config.destinationRoot,
        'Collections',
        'By Date',
        sanitizeFilesystemSegment(chosenYear),
        googleAlbumName
      );
      const destinationPathBeforeCollisionResolution = path.join(destinationFolder, chosenBaseFileName);

      planningCandidates.push({
        uniqueId,
        contentHash,
        canonSourcePath,
        shafferographyFileName,
        matchedArtifactSource,
        artifactRelativePath: artifactRecord?.relativePath ?? '',
        artifactFilePath: artifactRecord?.artifactFilePath ?? '',
        artifactManifestFolder: artifactRecord?.artifactManifestFolder ?? '',
        googleAlbumName,
        googleTakenAtIso,
        chosenYear,
        chosenBaseFileName,
        destinationFolder,
        destinationPathBeforeCollisionResolution
      });
    }
  } finally {
    await mongoClient.close();
  }

  const { plannedCopyRecords, collisionsRows } = resolveDestinationCollisions(planningCandidates);
  const plannedRows = plannedCopyRecords.map((record) => record.planRow);

  let copiedRows: CopiedCsvRow[] = [];
  let copyFailureRows: CopyFailureCsvRow[] = [];

  if (config.apply) {
    notes.push('APPLY mode enabled: files were copied into the planned destination tree.');
    const copyResult = await performCopyPlan(plannedRows);
    copiedRows = copyResult.copiedRows;
    copyFailureRows = copyResult.copyFailureRows;
  } else {
    notes.push('Plan-only mode: no filesystem copies were performed.');
  }

  const summary: SummaryReport = {
    canonItemsRead,
    matchedViaDedupPlanUnique,
    matchedViaAlreadyInCanon,
    unmatched: unmatchedRows.length,
    collisionCount: collisionsRows.length,
    rowsPlanned: plannedRows.length,
    destinationRoot: config.destinationRoot,
    dedupPlanFilesLoaded: dedupPlanArtifacts.filePaths.length,
    alreadyInCanonFilesLoaded: alreadyInCanonArtifacts.filePaths.length,
    canonicalInventoryFilesLoaded: canonicalInventoryArtifacts.filePaths.length,
    notes
  };

  await fs.mkdir(config.outputDirectory, { recursive: true });
  await Promise.all([
    fs.writeFile(
      path.join(config.outputDirectory, 'canon_to_tedography_plan.csv'),
      writeCsv(plannedRows, [
        'uniqueId',
        'contentHash',
        'canonSourcePath',
        'shafferographyFileName',
        'matchedArtifactSource',
        'artifactRelativePath',
        'artifactFilePath',
        'artifactManifestFolder',
        'googleAlbumName',
        'chosenYear',
        'chosenBaseFileName',
        'finalFileName',
        'destinationFolder',
        'destinationPath',
        'collisionApplied',
        'collisionReason',
        'copyAction'
      ])
    ),
    fs.writeFile(
      path.join(config.outputDirectory, 'canon_to_tedography_unmatched.csv'),
      writeCsv(unmatchedRows, [
        'uniqueId',
        'contentHash',
        'canonSourcePath',
        'shafferographyFileName',
        'googleAlbumName',
        'googleTakenAtIso',
        'artifactLookupSummary',
        'reason'
      ])
    ),
    fs.writeFile(
      path.join(config.outputDirectory, 'canon_to_tedography_collisions.csv'),
      writeCsv(collisionsRows, [
        'destinationPathBeforeCollisionResolution',
        'contentHash',
        'canonSourcePath',
        'finalResolvedDestinationPath',
        'collisionGroupSize'
      ])
    ),
    fs.writeFile(
      path.join(config.outputDirectory, 'canon_to_tedography_summary.json'),
      `${JSON.stringify(summary, null, 2)}\n`
    )
  ]);

  if (config.apply) {
    await Promise.all([
      fs.writeFile(
        path.join(config.outputDirectory, 'canon_to_tedography_copied.csv'),
        writeCsv(copiedRows, [
          'uniqueId',
          'contentHash',
          'canonSourcePath',
          'destinationPath',
          'copyStatus'
        ])
      ),
      fs.writeFile(
        path.join(config.outputDirectory, 'canon_to_tedography_copy_failures.csv'),
        writeCsv(copyFailureRows, [
          'uniqueId',
          'contentHash',
          'canonSourcePath',
          'destinationPath',
          'reason',
          'details'
        ])
      )
    ]);
  }

  console.log(`canon items read: ${canonItemsRead}`);
  console.log(`planned rows: ${plannedRows.length}`);
  console.log(`unmatched: ${unmatchedRows.length}`);
  console.log(`collision rows: ${collisionsRows.length}`);
  if (config.apply) {
    console.log(`copied/skipped identical: ${copiedRows.length}`);
    console.log(`copy failures: ${copyFailureRows.length}`);
  }
  console.log(`output: ${config.outputDirectory}`);
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Unknown error');
  process.exitCode = 1;
});
