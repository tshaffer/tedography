import fs from 'node:fs/promises';
import path from 'node:path';
import { isIgnorableFileName } from './supportedMedia.js';

export interface DiscoveredFile {
  absolutePath: string;
  relativePath: string;
  filename: string;
  sizeBytes: number;
  modifiedAt: Date;
}

export interface WalkImportFilesResult {
  files: DiscoveredFile[];
  totalFilesystemEntriesSeen: number;
}

function joinRelativePath(baseRelativePath: string, entryName: string): string {
  if (baseRelativePath === '') {
    return entryName;
  }

  return `${baseRelativePath}/${entryName}`;
}

async function walkDirectory(
  absoluteDirectoryPath: string,
  baseRelativePath: string,
  recursive: boolean,
  accumulator: WalkImportFilesResult
): Promise<void> {
  const entries = await fs.readdir(absoluteDirectoryPath, { withFileTypes: true });

  for (const entry of entries) {
    if (isIgnorableFileName(entry.name)) {
      continue;
    }

    accumulator.totalFilesystemEntriesSeen += 1;

    const entryAbsolutePath = path.join(absoluteDirectoryPath, entry.name);
    const entryRelativePath = joinRelativePath(baseRelativePath, entry.name);

    if (entry.isDirectory()) {
      if (recursive) {
        await walkDirectory(entryAbsolutePath, entryRelativePath, recursive, accumulator);
      }
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const fileStat = await fs.stat(entryAbsolutePath);
    accumulator.files.push({
      absolutePath: entryAbsolutePath,
      relativePath: entryRelativePath,
      filename: entry.name,
      sizeBytes: fileStat.size,
      modifiedAt: fileStat.mtime
    });
  }
}

export async function walkImportFiles(input: {
  absoluteBasePath: string;
  relativeBasePath: string;
  recursive: boolean;
}): Promise<WalkImportFilesResult> {
  const result: WalkImportFilesResult = {
    files: [],
    totalFilesystemEntriesSeen: 0
  };

  await walkDirectory(
    input.absoluteBasePath,
    input.relativeBasePath,
    input.recursive,
    result
  );

  result.files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

  return result;
}
