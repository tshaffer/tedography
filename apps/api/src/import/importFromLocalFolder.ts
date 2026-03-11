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

function normalizeRelativePath(relativePath: string): string {
  return relativePath.split(path.sep).join('/');
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

export async function importFromLocalFolder(importRoot: string): Promise<LocalImportSummary> {
  const summary: LocalImportSummary = {
    scanned: 0,
    imported: 0,
    updated: 0,
    unchanged: 0
  };

  const entries = await fs.readdir(importRoot, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    const extension = path.extname(entry.name).toLowerCase();
    if (!supportedImageExtensions.has(extension)) {
      continue;
    }

    summary.scanned += 1;

    const filePath = path.join(importRoot, entry.name);
    const fileStats = await fs.stat(filePath);
    const extractedMetadata = await extractMetadata(filePath);
    const upsertAssetInput = {
      id: buildImportAssetId(importRoot, filePath),
      filename: entry.name,
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
