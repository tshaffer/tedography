/**
 * find-duplicate-files.ts
 *
 * Scans a list of directories (recursively) and reports files that share both
 * the same name and the same size. Only .heic, .jpg, .jpeg, and .png files
 * are considered (case-insensitive).
 *
 * A "duplicate group" is two or more files with identical name + size found
 * at different paths.
 *
 * Usage:
 *   cd /Users/tedshaffer/src/tedography
 *   pnpm exec tsx scripts/find-duplicate-files.ts
 *
 * Edit the SCAN_DIRECTORIES constant below to specify which directories to scan.
 *
 * Output:
 *   Prints each duplicate group to stdout. Writes a JSON summary to
 *   scripts/output/find-duplicate-files.json.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Configuration ────────────────────────────────────────────────────────────

const SCAN_DIRECTORIES: string[] = [
  '/Volumes/ShMedia',
  '/Volumes/SHAFFEROTO',
  '/Users/tedshaffer/Pictures',
  '/Users/tedshaffer/Documents',
  // '/Volumes/ShMedia/Tedography/Media',
  // '/Volumes/SHAFFEROTO/BrightSign Laptop Files 4-30-2023/Pictures',
  // Add directories to scan here, e.g.:
  // '/Volumes/MyDrive/Photos',
  // '/Users/tedshaffer/Pictures',
];

const OUTPUT_PATH = path.resolve(__dirname, 'output/find-duplicate-files.json');

// ─── Types ────────────────────────────────────────────────────────────────────

interface FileEntry {
  filePath: string;
  name: string;
  sizeBytes: number;
}

interface DuplicateGroup {
  name: string;
  sizeBytes: number;
  duplicateCount: number;
  paths: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ALLOWED_EXTENSIONS = new Set(['.heic', '.jpg', '.jpeg', '.png']);

function isAllowedExtension(filePath: string): boolean {
  return ALLOWED_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

async function scanDirectory(dir: string, entries: FileEntry[]): Promise<void> {
  let dirents: Awaited<ReturnType<typeof fs.readdir>>;
  try {
    dirents = await fs.readdir(dir, { withFileTypes: true });
  } catch (error) {
    console.warn(`Warning: could not read directory "${dir}": ${(error as NodeJS.ErrnoException).message}`);
    return;
  }

  await Promise.all(
    dirents.map(async (dirent) => {
      const fullPath = path.join(dir, dirent.name);
      if (dirent.isDirectory()) {
        await scanDirectory(fullPath, entries);
      } else if (dirent.isFile() && isAllowedExtension(dirent.name)) {
        try {
          const stat = await fs.stat(fullPath);
          entries.push({ filePath: fullPath, name: dirent.name, sizeBytes: stat.size });
        } catch (error) {
          console.warn(`Warning: could not stat "${fullPath}": ${(error as NodeJS.ErrnoException).message}`);
        }
      }
    })
  );
}

function findDuplicates(entries: FileEntry[]): DuplicateGroup[] {
  const index = new Map<string, string[]>();

  for (const entry of entries) {
    const key = `${entry.name}\0${entry.sizeBytes}`;
    const existing = index.get(key);
    if (existing) {
      existing.push(entry.filePath);
    } else {
      index.set(key, [entry.filePath]);
    }
  }

  const groups: DuplicateGroup[] = [];
  for (const [key, paths] of index) {
    if (paths.length > 1) {
      const [name, sizeStr] = key.split('\0');
      groups.push({ name, sizeBytes: Number(sizeStr), duplicateCount: paths.length, paths });
    }
  }

  return groups.sort((a, b) => a.name.localeCompare(b.name));
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  if (SCAN_DIRECTORIES.length === 0) {
    console.error('Error: SCAN_DIRECTORIES is empty. Edit the script and add directories to scan.');
    process.exitCode = 1;
    return;
  }

  console.log(`Scanning ${SCAN_DIRECTORIES.length} ${SCAN_DIRECTORIES.length === 1 ? 'directory' : 'directories'}...`);
  for (const dir of SCAN_DIRECTORIES) {
    console.log(`  ${dir}`);
  }
  console.log('');

  const entries: FileEntry[] = [];
  for (const dir of SCAN_DIRECTORIES) {
    await scanDirectory(dir, entries);
  }

  console.log(`Found ${entries.length} eligible files.`);

  const groups = findDuplicates(entries);
  const totalDuplicateFiles = groups.reduce((sum, g) => sum + g.paths.length, 0);

  console.log(`Duplicate groups: ${groups.length} (${totalDuplicateFiles} files total)`);
  console.log('');

  if (groups.length === 0) {
    console.log('No duplicates found.');
  } else {
    for (const group of groups) {
      console.log(`${group.name}  [${formatBytes(group.sizeBytes)}]  — ${group.paths.length} copies`);
      for (const p of group.paths) {
        console.log(`  ${p}`);
      }
    }
  }

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, JSON.stringify({ groups }, null, 2), 'utf8');
  console.log('');
  console.log(`Full results written to: ${OUTPUT_PATH}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
