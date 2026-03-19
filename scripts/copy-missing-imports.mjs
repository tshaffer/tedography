#!/usr/bin/env node
/**
 * copy-missing-imports.mjs
 *
 * Project-ready Node script to copy files listed in a CSV into:
 *   /Volumes/ShMedia/Shafferography/ShafferographyMediaNew/MissingFromImports
 *
 * Expected CSV columns:
 *   - filePath
 *   - fileName
 *
 * Behavior:
 *   - Copies each source file from filePath
 *   - Uses fileName as the destination filename
 *   - If a collision occurs, appends _1, _2, ... before the extension
 *   - Writes a manifest CSV describing copied / skipped / missing / errored rows
 *
 * Usage:
 *   node scripts/copy-missing-imports.mjs \
 *     --csv /absolute/path/to/shafferography_only.csv
 *
 * Optional:
 *   --dest /Volumes/ShMedia/Shafferography/ShafferographyMediaNew/MissingFromImports
 *   --manifest /absolute/path/to/copy_manifest.csv
 *   --dry-run
 */

import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_DEST =
  '/Volumes/ShMedia/Shafferography/ShafferographyMediaNew/MissingFromImports';

function main() {
  const args = parseArgs(process.argv);

  ensureFileExists(args.csv, `CSV file not found: ${args.csv}`);

  const csvText = fs.readFileSync(args.csv, 'utf8');
  const records = parseCsv(csvText);

  validateRequiredColumns(records);

  if (!args.dryRun) {
    fs.mkdirSync(args.dest, { recursive: true });
  } else if (!fs.existsSync(args.dest)) {
    console.log(`[dry-run] Would create destination directory: ${args.dest}`);
  }

  const reservedNames = new Set();
  if (fs.existsSync(args.dest)) {
    for (const entry of fs.readdirSync(args.dest)) {
      reservedNames.add(entry);
    }
  }

  const manifestRows = [];
  let copiedCount = 0;
  let missingSourceCount = 0;
  let errorCount = 0;
  let renamedCount = 0;

  for (const [index, record] of records.entries()) {
    const csvRow = index + 2;
    const sourcePath = String(record.filePath ?? '').trim();
    const requestedFileName = String(record.fileName ?? '').trim();

    if (!sourcePath || !requestedFileName) {
      manifestRows.push([
        csvRow,
        sourcePath,
        requestedFileName,
        '',
        'error',
        'Missing filePath or fileName',
      ]);
      errorCount += 1;
      continue;
    }

    if (!fs.existsSync(sourcePath)) {
      manifestRows.push([
        csvRow,
        sourcePath,
        requestedFileName,
        '',
        'missing-source',
        'Source file not found',
      ]);
      missingSourceCount += 1;
      continue;
    }

    const finalFileName = chooseUniqueFileName(args.dest, requestedFileName, reservedNames);
    const finalDestinationPath = path.join(args.dest, finalFileName);
    const renamed = finalFileName !== requestedFileName;

    if (renamed) {
      renamedCount += 1;
    }

    try {
      if (args.dryRun) {
        console.log(`[dry-run] ${sourcePath} -> ${finalDestinationPath}`);
      } else {
        fs.copyFileSync(sourcePath, finalDestinationPath, fs.constants.COPYFILE_EXCL);
      }

      manifestRows.push([
        csvRow,
        sourcePath,
        requestedFileName,
        finalDestinationPath,
        args.dryRun ? 'would-copy' : 'copied',
        renamed ? `Renamed to avoid collision: ${finalFileName}` : '',
      ]);
      copiedCount += 1;
    } catch (error) {
      manifestRows.push([
        csvRow,
        sourcePath,
        requestedFileName,
        finalDestinationPath,
        'error',
        error instanceof Error ? error.message : String(error),
      ]);
      errorCount += 1;
    }
  }

  if (args.dryRun) {
    console.log(`[dry-run] Would write manifest: ${args.manifest}`);
  } else {
    writeCsv(
      args.manifest,
      ['csvRow', 'sourcePath', 'requestedFileName', 'finalDestinationPath', 'status', 'notes'],
      manifestRows
    );
  }

  console.log('');
  console.log(`Rows processed: ${records.length}`);
  console.log(`Copied: ${copiedCount}`);
  console.log(`Missing source: ${missingSourceCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log(`Renamed due to collision: ${renamedCount}`);
  console.log(`Manifest: ${args.manifest}`);
}

function parseArgs(argv) {
  const args = {
    csv: '',
    dest: DEFAULT_DEST,
    manifest: '',
    dryRun: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--csv') {
      args.csv = argv[++i] ?? '';
    } else if (arg === '--dest') {
      args.dest = argv[++i] ?? '';
    } else if (arg === '--manifest') {
      args.manifest = argv[++i] ?? '';
    } else if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelpAndExit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      printHelpAndExit(1);
    }
  }

  if (!args.csv) {
    console.error('Missing required --csv argument');
    printHelpAndExit(1);
  }

  if (!args.manifest) {
    args.manifest = path.join(args.dest, 'copy_manifest.csv');
  }

  return args;
}

function printHelpAndExit(code) {
  console.log(`
Usage:
  node scripts/copy-missing-imports.mjs --csv <csv-path> [options]

Required:
  --csv <path>          Path to CSV file with filePath and fileName columns

Optional:
  --dest <dir>          Destination directory
                        Default: ${DEFAULT_DEST}

  --manifest <path>     Manifest CSV output path
                        Default: <dest>/copy_manifest.csv

  --dry-run             Show actions without copying or writing manifest
  --help, -h            Show this help
`);
  process.exit(code);
}

function ensureFileExists(filePath, message) {
  if (!fs.existsSync(filePath)) {
    throw new Error(message);
  }
}

function validateRequiredColumns(records) {
  if (records.length === 0) {
    return;
  }

  const first = records[0];
  if (!Object.prototype.hasOwnProperty.call(first, 'filePath')) {
    throw new Error('CSV is missing required column: filePath');
  }
  if (!Object.prototype.hasOwnProperty.call(first, 'fileName')) {
    throw new Error('CSV is missing required column: fileName');
  }
}

function chooseUniqueFileName(destDir, requestedFileName, reservedNames) {
  const ext = path.extname(requestedFileName);
  const stem = path.basename(requestedFileName, ext);

  let candidateName = requestedFileName;
  let counter = 1;

  while (
    reservedNames.has(candidateName) ||
    fs.existsSync(path.join(destDir, candidateName))
  ) {
    candidateName = `${stem}_${counter}${ext}`;
    counter += 1;
  }

  reservedNames.add(candidateName);
  return candidateName;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        value += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        value += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(value);
        value = '';
      } else if (ch === '\n') {
        row.push(value);
        rows.push(row);
        row = [];
        value = '';
      } else if (ch === '\r') {
        // ignore
      } else {
        value += ch;
      }
    }
  }

  if (value.length > 0 || row.length > 0) {
    row.push(value);
    rows.push(row);
  }

  if (rows.length === 0) {
    return [];
  }

  const headers = rows[0];
  return rows
    .slice(1)
    .filter((r) => r.some((cell) => String(cell ?? '').trim() !== ''))
    .map((r) => {
      const obj = {};
      for (let i = 0; i < headers.length; i += 1) {
        obj[headers[i]] = r[i] ?? '';
      }
      return obj;
    });
}

function writeCsv(filePath, headers, rows) {
  const lines = [
    headers.map(csvEscape).join(','),
    ...rows.map((row) => row.map((cell) => csvEscape(String(cell ?? ''))).join(',')),
  ];
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');
}

function csvEscape(value) {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

main();
