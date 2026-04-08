#!/usr/bin/env tsx

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_RUNS_ROOT = '/Volumes/ShMedia/PHOTO_ARCHIVE/RUNS';
const DEFAULT_OUTPUT_PATH = fileURLToPath(
  new URL('../../../scripts/output/listPre2000TakeoutSidecars.json', import.meta.url)
);

type ParsedArgs = {
  runsRoot: string;
  outputPath: string;
};

type OutputRecord = {
  formattedDate: string;
  isoDate: string;
  sidecarPath: string;
  mediaPath: string | null;
};

function parseArgs(argv: string[]): ParsedArgs {
  const args: ParsedArgs = {
    runsRoot: DEFAULT_RUNS_ROOT,
    outputPath: DEFAULT_OUTPUT_PATH
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

    if (arg === '--output') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Missing value for --output');
      }
      args.outputPath = value;
      index += 1;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      printHelpAndExit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function printHelpAndExit(code: number): never {
  console.log(`
Usage:
  pnpm --filter @tedography/api exec tsx src/tools/listPre2000TakeoutSidecars.ts

Options:
  --runs-root <path>    Default: ${DEFAULT_RUNS_ROOT}
  --output <path>       Default: ${DEFAULT_OUTPUT_PATH}
  --help, -h
`);
  process.exit(code);
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

function getAssociatedMediaPath(sidecarPath: string): string | null {
  const suffix = '.supplemental-metadata.json';
  if (!sidecarPath.endsWith(suffix)) {
    return null;
  }

  const mediaPath = sidecarPath.slice(0, -suffix.length);
  return fs.existsSync(mediaPath) ? mediaPath : null;
}

function isSupplementalMetadataJson(filePath: string): boolean {
  return path.basename(filePath).endsWith('.supplemental-metadata.json');
}

function parseFormattedDate(value: unknown): Date | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function writeOutput(outputPath: string, runsRoot: string, records: OutputRecord[]): void {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(
    outputPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        runsRoot,
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

  const records: OutputRecord[] = [];

  walk(args.runsRoot, (fullPath) => {
    if (!isSupplementalMetadataJson(fullPath)) {
      return;
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(fs.readFileSync(fullPath, 'utf8')) as unknown;
    } catch {
      return;
    }

    if (parsedJson === null || typeof parsedJson !== 'object') {
      return;
    }

    const photoTakenTime = (parsedJson as { photoTakenTime?: unknown }).photoTakenTime;
    if (photoTakenTime === null || typeof photoTakenTime !== 'object') {
      return;
    }

    const formatted = (photoTakenTime as { formatted?: unknown }).formatted;
    const parsedDate = parseFormattedDate(formatted);
    if (!parsedDate || parsedDate.getUTCFullYear() >= 2000) {
      return;
    }

    records.push({
      formattedDate: String(formatted),
      isoDate: parsedDate.toISOString(),
      sidecarPath: fullPath,
      mediaPath: getAssociatedMediaPath(fullPath)
    });
  });

  records.sort((left, right) => {
    if (left.isoDate !== right.isoDate) {
      return left.isoDate.localeCompare(right.isoDate);
    }

    return left.sidecarPath.localeCompare(right.sidecarPath);
  });

  writeOutput(args.outputPath, args.runsRoot, records);

  console.log(`Found ${records.length} matching sidecar files.`);
  console.log(`Output written to ${args.outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
