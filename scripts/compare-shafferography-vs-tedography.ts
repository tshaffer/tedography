/**
 * compare-shafferography-vs-tedography.ts
 *
 * Compares Shafferography mediaitems vs Tedography mediaAssets and reports:
 *   - paths present in Shafferography but not Tedography
 *   - paths present in Tedography but not Shafferography
 *   - matched pairs
 *   - ambiguous stem matches
 *
 * Matching strategy, in order:
 *   1) content hash
 *   2) normalized path-without-extension
 *   3) basename stem
 *
 * Usage:
 *   SHAF_MONGO_URI="mongodb://127.0.0.1:27017/shafferography" \
 *   TEDO_MONGO_URI="mongodb://127.0.0.1:27017/tedography" \
 *   npx tsx scripts/compare-shafferography-vs-tedography.ts
 *
 * Optional env vars:
 *   OUTPUT_DIR=./scripts/output
 *   SHAF_DB_NAME=shafferography
 *   TEDO_DB_NAME=tedography
 */

import fs from 'node:fs';
import path from 'node:path';
import mongoose, { Connection } from 'mongoose';

type ShafferographyDoc = {
  _id: unknown;
  uniqueId?: string;
  contentHash?: string;
  fileName?: string;
  filePath?: string;
  mimeType?: string;
};

type TedographyDoc = {
  _id: unknown;
  id: string;
  filename: string;
  originalArchivePath: string;
  originalContentHash: string;
  originalFileFormat?: string;
  displayDerivedPath?: string;
};

type ShaRecord = {
  source: 'shafferography';
  dbId: string;
  uniqueId: string;
  filePath: string;
  fileName: string;
  contentHash: string;
  candidateKeys: string[];
  stemKeys: string[];
};

type TedRecord = {
  source: 'tedography';
  dbId: string;
  id: string;
  originalArchivePath: string;
  displayDerivedPath: string;
  filename: string;
  originalContentHash: string;
  candidateKeys: string[];
  stemKeys: string[];
};

type MatchReason = 'contentHash' | 'candidatePath' | 'stem';

type MatchRow = {
  reason: MatchReason;
  shafferographyPath: string;
  tedographyPath: string;
  shafferographyUniqueId: string;
  tedographyId: string;
  shafferographyContentHash: string;
  tedographyContentHash: string;
};

type AmbiguousStemRow = {
  stem: string;
  shafferographyPaths: string[];
  tedographyPaths: string[];
};

const SHAF_MONGO_URI = mustGetEnv('SHAF_MONGO_URI');
const TEDO_MONGO_URI = mustGetEnv('TEDO_MONGO_URI');
const SHAF_DB_NAME = process.env.SHAF_DB_NAME || undefined;
const TEDO_DB_NAME = process.env.TEDO_DB_NAME || undefined;
const OUTPUT_DIR = process.env.OUTPUT_DIR || path.resolve(process.cwd(), 'scripts/output');

async function main(): Promise<void> {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const shafConn = await mongoose.createConnection(SHAF_MONGO_URI, {
    dbName: SHAF_DB_NAME,
  }).asPromise();

  const tedoConn = await mongoose.createConnection(TEDO_MONGO_URI, {
    dbName: TEDO_DB_NAME,
  }).asPromise();

  try {
    const shafDocs = await loadShafferography(shafConn);
    const tedoDocs = await loadTedography(tedoConn);

    console.log(`Loaded ${shafDocs.length} Shafferography docs`);
    console.log(`Loaded ${tedoDocs.length} Tedography docs`);

    const shaRecords = shafDocs.map(toShaRecord);
    const tedRecords = tedoDocs.map(toTedRecord);

    const result = compareRecords(shaRecords, tedRecords);

    writeCsv(
      path.join(OUTPUT_DIR, 'matched_pairs.csv'),
      [
        'reason',
        'shafferographyPath',
        'tedographyPath',
        'shafferographyUniqueId',
        'tedographyId',
        'shafferographyContentHash',
        'tedographyContentHash',
      ],
      result.matches.map((m) => [
        m.reason,
        m.shafferographyPath,
        m.tedographyPath,
        m.shafferographyUniqueId,
        m.tedographyId,
        m.shafferographyContentHash,
        m.tedographyContentHash,
      ])
    );

    writeCsv(
      path.join(OUTPUT_DIR, 'shafferography_only.csv'),
      [
        'filePath',
        'fileName',
        'uniqueId',
        'contentHash',
        'candidateKeys',
        'stemKeys',
      ],
      result.shafferographyOnly.map((r) => [
        r.filePath,
        r.fileName,
        r.uniqueId,
        r.contentHash,
        r.candidateKeys.join(' | '),
        r.stemKeys.join(' | '),
      ])
    );

    writeCsv(
      path.join(OUTPUT_DIR, 'tedography_only.csv'),
      [
        'originalArchivePath',
        'displayDerivedPath',
        'filename',
        'id',
        'originalContentHash',
        'candidateKeys',
        'stemKeys',
      ],
      result.tedographyOnly.map((r) => [
        r.originalArchivePath,
        r.displayDerivedPath,
        r.filename,
        r.id,
        r.originalContentHash,
        r.candidateKeys.join(' | '),
        r.stemKeys.join(' | '),
      ])
    );

    writeCsv(
      path.join(OUTPUT_DIR, 'ambiguous_stem_matches.csv'),
      ['stem', 'shafferographyPaths', 'tedographyPaths'],
      result.ambiguousStemMatches.map((r) => [
        r.stem,
        r.shafferographyPaths.join(' | '),
        r.tedographyPaths.join(' | '),
      ])
    );

    console.log('');
    console.log('Done.');
    console.log(`Matched pairs: ${result.matches.length}`);
    console.log(`Shafferography only: ${result.shafferographyOnly.length}`);
    console.log(`Tedography only: ${result.tedographyOnly.length}`);
    console.log(`Ambiguous stem groups: ${result.ambiguousStemMatches.length}`);
    console.log(`Output directory: ${OUTPUT_DIR}`);
  } finally {
    await Promise.allSettled([shafConn.close(), tedoConn.close()]);
  }
}

async function loadShafferography(conn: Connection): Promise<ShafferographyDoc[]> {
  return conn.collection('mediaitems')
    .find(
      {},
      {
        projection: {
          _id: 1,
          uniqueId: 1,
          contentHash: 1,
          fileName: 1,
          filePath: 1,
          mimeType: 1,
        },
      }
    )
    .toArray() as Promise<ShafferographyDoc[]>;
}

async function loadTedography(conn: Connection): Promise<TedographyDoc[]> {
  return conn.collection('mediaAssets')
    .find(
      {},
      {
        projection: {
          _id: 1,
          id: 1,
          filename: 1,
          originalArchivePath: 1,
          originalContentHash: 1,
          originalFileFormat: 1,
          displayDerivedPath: 1,
        },
      }
    )
    .toArray() as Promise<TedographyDoc[]>;
}

function toShaRecord(doc: ShafferographyDoc): ShaRecord {
  const filePath = normalizeSlashes(doc.filePath || '');
  const fileName = doc.fileName || path.posix.basename(filePath);
  const contentHash = (doc.contentHash || '').trim().toLowerCase();

  const candidateKeys = uniqueNonEmpty([
    buildRelativeNoExtKey(filePath),
    buildRelativeNoExtKey(fileName),
    buildDisplayJpegCollapsedKey(filePath),
  ]);

  const stemKeys = uniqueNonEmpty([
    buildStemKey(filePath),
    buildStemKey(fileName),
  ]);

  return {
    source: 'shafferography',
    dbId: String(doc._id),
    uniqueId: doc.uniqueId || String(doc._id),
    filePath,
    fileName,
    contentHash,
    candidateKeys,
    stemKeys,
  };
}

function toTedRecord(doc: TedographyDoc): TedRecord {
  const originalArchivePath = normalizeSlashes(doc.originalArchivePath || '');
  const displayDerivedPath = normalizeSlashes(doc.displayDerivedPath || '');
  const filename = doc.filename || path.posix.basename(originalArchivePath);
  const originalContentHash = (doc.originalContentHash || '').trim().toLowerCase();

  const candidateKeys = uniqueNonEmpty([
    buildRelativeNoExtKey(originalArchivePath),
    buildRelativeNoExtKey(displayDerivedPath),
    buildRelativeNoExtKey(filename),
    buildDisplayJpegCollapsedKey(displayDerivedPath),
  ]);

  const stemKeys = uniqueNonEmpty([
    buildStemKey(originalArchivePath),
    buildStemKey(displayDerivedPath),
    buildStemKey(filename),
  ]);

  return {
    source: 'tedography',
    dbId: String(doc._id),
    id: doc.id,
    originalArchivePath,
    displayDerivedPath,
    filename,
    originalContentHash,
    candidateKeys,
    stemKeys,
  };
}

function compareRecords(shaRecords: ShaRecord[], tedRecords: TedRecord[]) {
  const matches: MatchRow[] = [];

  const unmatchedSha = new Map<string, ShaRecord>(shaRecords.map((r) => [r.dbId, r]));
  const unmatchedTed = new Map<string, TedRecord>(tedRecords.map((r) => [r.dbId, r]));

  // 1) content hash exact match
  const tedByHash = buildSingleIndex(tedRecords, (r) => r.originalContentHash);
  for (const sha of shaRecords) {
    if (!sha.contentHash) continue;
    const ted = tedByHash.get(sha.contentHash);
    if (!ted) continue;
    if (!unmatchedSha.has(sha.dbId) || !unmatchedTed.has(ted.dbId)) continue;

    consumeMatch(matches, unmatchedSha, unmatchedTed, sha, ted, 'contentHash');
  }

  // 2) candidate path key
  const tedByCandidate = buildSingleIndex(
    [...unmatchedTed.values()],
    (r) => r.candidateKeys,
    true
  );

  for (const sha of [...unmatchedSha.values()]) {
    const ted = getSingleMatchByKeys(tedByCandidate, sha.candidateKeys);
    if (!ted) continue;
    if (!unmatchedSha.has(sha.dbId) || !unmatchedTed.has(ted.dbId)) continue;

    consumeMatch(matches, unmatchedSha, unmatchedTed, sha, ted, 'candidatePath');
  }

  // 3) stem key, but only when unique on both sides
  const tedByStem = buildSingleIndex(
    [...unmatchedTed.values()],
    (r) => r.stemKeys,
    true
  );

  for (const sha of [...unmatchedSha.values()]) {
    const ted = getSingleMatchByKeys(tedByStem, sha.stemKeys);
    if (!ted) continue;
    if (!unmatchedSha.has(sha.dbId) || !unmatchedTed.has(ted.dbId)) continue;

    consumeMatch(matches, unmatchedSha, unmatchedTed, sha, ted, 'stem');
  }

  // ambiguous stem groups for manual review
  const ambiguousStemMatches = collectAmbiguousStemGroups(
    [...unmatchedSha.values()],
    [...unmatchedTed.values()]
  );

  return {
    matches,
    shafferographyOnly: [...unmatchedSha.values()].sort((a, b) =>
      a.filePath.localeCompare(b.filePath)
    ),
    tedographyOnly: [...unmatchedTed.values()].sort((a, b) =>
      a.originalArchivePath.localeCompare(b.originalArchivePath)
    ),
    ambiguousStemMatches,
  };
}

function consumeMatch(
  matches: MatchRow[],
  unmatchedSha: Map<string, ShaRecord>,
  unmatchedTed: Map<string, TedRecord>,
  sha: ShaRecord,
  ted: TedRecord,
  reason: MatchReason
): void {
  unmatchedSha.delete(sha.dbId);
  unmatchedTed.delete(ted.dbId);

  matches.push({
    reason,
    shafferographyPath: sha.filePath,
    tedographyPath: ted.originalArchivePath,
    shafferographyUniqueId: sha.uniqueId,
    tedographyId: ted.id,
    shafferographyContentHash: sha.contentHash,
    tedographyContentHash: ted.originalContentHash,
  });
}

function buildSingleIndex<T>(
  records: T[],
  keyGetter: (record: T) => string | string[],
  multipleKeys = false
): Map<string, T> {
  const groups = new Map<string, T[]>();

  for (const record of records) {
    const raw = keyGetter(record);
    const keys = Array.isArray(raw) ? raw : [raw];

    for (const key of keys) {
      const normalized = (key || '').trim();
      if (!normalized) continue;
      const arr = groups.get(normalized) || [];
      arr.push(record);
      groups.set(normalized, arr);
    }

    if (!multipleKeys && Array.isArray(raw)) {
      throw new Error('buildSingleIndex received array keys with multipleKeys=false');
    }
  }

  const single = new Map<string, T>();
  for (const [key, arr] of groups.entries()) {
    if (arr.length === 1) {
      single.set(key, arr[0]);
    }
  }
  return single;
}

function getSingleMatchByKeys<T>(index: Map<string, T>, keys: string[]): T | undefined {
  for (const key of keys) {
    const found = index.get(key);
    if (found) return found;
  }
  return undefined;
}

function collectAmbiguousStemGroups(
  shaRecords: ShaRecord[],
  tedRecords: TedRecord[]
): AmbiguousStemRow[] {
  const shaByStem = new Map<string, ShaRecord[]>();
  const tedByStem = new Map<string, TedRecord[]>();

  for (const sha of shaRecords) {
    for (const stem of sha.stemKeys) {
      if (!stem) continue;
      const arr = shaByStem.get(stem) || [];
      arr.push(sha);
      shaByStem.set(stem, arr);
    }
  }

  for (const ted of tedRecords) {
    for (const stem of ted.stemKeys) {
      if (!stem) continue;
      const arr = tedByStem.get(stem) || [];
      arr.push(ted);
      tedByStem.set(stem, arr);
    }
  }

  const allStems = new Set([...shaByStem.keys(), ...tedByStem.keys()]);
  const rows: AmbiguousStemRow[] = [];

  for (const stem of allStems) {
    const shaList = uniqueBy((shaByStem.get(stem) || []), (r) => r.dbId);
    const tedList = uniqueBy((tedByStem.get(stem) || []), (r) => r.dbId);

    if (shaList.length === 0 || tedList.length === 0) continue;
    if (shaList.length === 1 && tedList.length === 1) continue;

    rows.push({
      stem,
      shafferographyPaths: shaList.map((r) => r.filePath).sort(),
      tedographyPaths: tedList.map((r) => r.originalArchivePath).sort(),
    });
  }

  return rows.sort((a, b) => a.stem.localeCompare(b.stem));
}

function buildRelativeNoExtKey(inputPath: string): string {
  const normalized = normalizeSlashes(inputPath);
  if (!normalized) return '';

  const cleaned = collapseKnownPrefixes(normalized);
  const noExt = removeExtension(cleaned);
  return normalizeComparablePath(noExt);
}

function buildDisplayJpegCollapsedKey(inputPath: string): string {
  const normalized = normalizeSlashes(inputPath);
  if (!normalized) return '';

  let s = collapseKnownPrefixes(normalized);

  // Heuristic: if path contains a derived/display-jpeg style folder,
  // use only the tail after that folder so it can align with originalArchivePath.
  const markers = [
    '/display-jpegs/',
    '/display_jpegs/',
    '/derived/display-jpegs/',
    '/derived/display_jpegs/',
    '/thumbnails/',
  ];

  for (const marker of markers) {
    const idx = s.toLowerCase().indexOf(marker);
    if (idx >= 0) {
      s = s.slice(idx + marker.length);
      break;
    }
  }

  return normalizeComparablePath(removeExtension(s));
}

function buildStemKey(inputPath: string): string {
  const normalized = normalizeSlashes(inputPath);
  if (!normalized) return '';
  const base = path.posix.basename(normalized);
  const noExt = removeExtension(base);
  return noExt.trim().toLowerCase();
}

function collapseKnownPrefixes(inputPath: string): string {
  const normalized = normalizeSlashes(inputPath).trim();

  // Strip leading absolute path noise so relative archive paths compare better.
  const prefixes = [
    '/Volumes/ShMedia/',
    '/Volumes/SHAFFEROTO/',
    '/Users/',
    '/private/',
  ];

  for (const prefix of prefixes) {
    if (normalized.startsWith(prefix)) {
      const idx = normalized.indexOf('/', prefix.length);
      if (idx >= 0) {
        return normalized.slice(idx + 1);
      }
    }
  }

  return normalized;
}

function normalizeComparablePath(input: string): string {
  return normalizeSlashes(input)
    .replace(/^\.\/+/, '')
    .replace(/^\/+/, '')
    .replace(/\/+/g, '/')
    .trim()
    .toLowerCase();
}

function normalizeSlashes(input: string): string {
  return (input || '').replace(/\\/g, '/');
}

function removeExtension(input: string): string {
  const dir = path.posix.dirname(input);
  const base = path.posix.basename(input);
  const ext = path.posix.extname(base);
  const stem = ext ? base.slice(0, -ext.length) : base;

  if (!dir || dir === '.') return stem;
  return `${dir}/${stem}`;
}

function writeCsv(filePath: string, headers: string[], rows: Array<Array<string | number>>): void {
  const lines = [
    headers.map(csvEscape).join(','),
    ...rows.map((row) => row.map((v) => csvEscape(String(v ?? ''))).join(',')),
  ];
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function uniqueNonEmpty(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))];
}

function uniqueBy<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function mustGetEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});