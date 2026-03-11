import fs from 'node:fs/promises';
import path from 'node:path';
import { extractMetadata } from '@tedography/media-metadata';
import { upsertImportedAsset } from '../repositories/assetRepository.js';

const supportedImageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

export type LocalImportSummary = {
  scanned: number;
  imported: number;
  updated: number;
  unchanged: number;
};

export type ImportableLocalFile = {
  relativePath: string;
  filename: string;
  size: number;
  modifiedTime: string;
};

function normalizeRelativePath(relativePath: string): string {
  return relativePath.split(path.sep).join('/');
}

function toSystemPath(relativePath: string): string {
  return relativePath.split('/').join(path.sep);
}

function isWithinRoot(importRoot: string, candidatePath: string): boolean {
  const relative = path.relative(importRoot, candidatePath);
  return !relative.startsWith('..') && !path.isAbsolute(relative);
}

function isImportableImage(fileName: string): boolean {
  const extension = path.extname(fileName).toLowerCase();
  return supportedImageExtensions.has(extension);
}

function buildImportAssetId(importRoot: string, filePath: string): string {
  const relativePath = normalizeRelativePath(path.relative(importRoot, filePath));
  // v1: deterministic id derived from import-root-relative file path.
  return `import:${relativePath}`;
}

function buildImportMediaUrl(importRoot: string, filePath: string): string {
  const relativePath = normalizeRelativePath(path.relative(importRoot, filePath));
  return `/import-media/${relativePath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')}`;
}

export async function listImportableFiles(importRoot: string): Promise<ImportableLocalFile[]> {
  const entries = await fs.readdir(importRoot, { withFileTypes: true });
  const importableFiles: ImportableLocalFile[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !isImportableImage(entry.name)) {
      continue;
    }

    const filePath = path.join(importRoot, entry.name);
    const fileStats = await fs.stat(filePath);

    importableFiles.push({
      relativePath: normalizeRelativePath(entry.name),
      filename: entry.name,
      size: fileStats.size,
      modifiedTime: fileStats.mtime.toISOString()
    });
  }

  return importableFiles.sort((left, right) => left.filename.localeCompare(right.filename));
}

async function resolveImportPaths(
  importRoot: string,
  selectedRelativePaths?: string[]
): Promise<string[]> {
  if (!selectedRelativePaths) {
    const files = await listImportableFiles(importRoot);
    return files.map((file) => path.join(importRoot, toSystemPath(file.relativePath)));
  }

  const uniqueRelativePaths = Array.from(new Set(selectedRelativePaths));
  const resolvedFilePaths: string[] = [];

  for (const relativePath of uniqueRelativePaths) {
    if (relativePath.trim().length === 0) {
      continue;
    }

    const normalizedRelativePath = normalizeRelativePath(relativePath);
    const candidatePath = path.resolve(importRoot, toSystemPath(normalizedRelativePath));

    if (!isWithinRoot(importRoot, candidatePath)) {
      throw new Error(`Invalid selected path: ${relativePath}`);
    }

    const fileStats = await fs.stat(candidatePath).catch(() => null);
    if (!fileStats || !fileStats.isFile()) {
      throw new Error(`Selected file not found: ${relativePath}`);
    }

    if (!isImportableImage(path.basename(candidatePath))) {
      throw new Error(`Unsupported file type: ${relativePath}`);
    }

    resolvedFilePaths.push(candidatePath);
  }

  return resolvedFilePaths;
}

export async function importFromLocalFolder(
  importRoot: string,
  selectedRelativePaths?: string[]
): Promise<LocalImportSummary> {
  const summary: LocalImportSummary = {
    scanned: 0,
    imported: 0,
    updated: 0,
    unchanged: 0
  };

  const filePaths = await resolveImportPaths(importRoot, selectedRelativePaths);

  for (const filePath of filePaths) {
    summary.scanned += 1;

    const fileStats = await fs.stat(filePath);
    const extractedMetadata = await extractMetadata(filePath);
    const upsertAssetInput = {
      id: buildImportAssetId(importRoot, filePath),
      filename: path.basename(filePath),
      captureDateTime: extractedMetadata.captureDateTime ?? fileStats.mtime.toISOString(),
      thumbnailUrl: buildImportMediaUrl(importRoot, filePath),
      ...(typeof extractedMetadata.width === 'number' ? { width: extractedMetadata.width } : {}),
      ...(typeof extractedMetadata.height === 'number' ? { height: extractedMetadata.height } : {})
    };

    const outcome = await upsertImportedAsset(upsertAssetInput);

    if (outcome === 'inserted') {
      summary.imported += 1;
      continue;
    }

    if (outcome === 'updated') {
      summary.updated += 1;
      continue;
    }

    summary.unchanged += 1;
  }

  return summary;
}
