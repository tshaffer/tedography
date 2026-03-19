import { type MediaAsset } from '@tedography/domain';
import fs from 'node:fs/promises';
import path from 'node:path';

export interface StorageRootConfig {
  id: string;
  label: string;
  absolutePath: string;
}

export type MediaAssetDocument = MediaAsset & {
  updatedAt?: Date;
};

export type AnalysisSourceType = 'original' | 'derived-jpeg';

export interface AnalysisSourceCandidate {
  type: AnalysisSourceType;
  path: string;
  strategy: 'original' | 'original-then-derived-jpeg-fallback';
  label: string;
}

export interface DerivedJpegReference {
  kind: 'display-derived-jpeg' | 'thumbnail-derived-jpeg';
  relativePath: string;
  absolutePath: string;
  exists: boolean;
}

export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function parseStorageRoots(value: string | undefined): StorageRootConfig[] {
  if (!value || value.trim().length === 0) {
    return [];
  }

  return value
    .split(';')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => {
      const [id, label, absolutePath] = entry.split('|');
      if (!id || !label || !absolutePath) {
        throw new Error(`Invalid TEDOGRAPHY_STORAGE_ROOTS entry: ${entry}`);
      }

      return { id, label, absolutePath };
    });
}

export function resolveAssetSourcePath(
  asset: MediaAsset,
  storageRoots: StorageRootConfig[]
): string {
  const storageRootId =
    typeof asset.originalStorageRootId === 'string' && asset.originalStorageRootId.length > 0
      ? asset.originalStorageRootId
      : typeof asset.storageRootId === 'string' && asset.storageRootId.length > 0
        ? asset.storageRootId
        : null;
  const archivePath =
    typeof asset.originalArchivePath === 'string' && asset.originalArchivePath.length > 0
      ? asset.originalArchivePath
      : typeof asset.archivePath === 'string' && asset.archivePath.length > 0
        ? asset.archivePath
        : null;

  if (!storageRootId || !archivePath) {
    throw new Error('Asset does not contain a resolvable original file reference.');
  }

  const storageRoot = storageRoots.find((root) => root.id === storageRootId);
  if (!storageRoot) {
    throw new Error(`Storage root not found for asset: ${storageRootId}`);
  }

  const resolvedPath = path.resolve(storageRoot.absolutePath, archivePath);
  if (!resolvedPath.startsWith(storageRoot.absolutePath)) {
    throw new Error(`Resolved asset path escaped the storage root: ${archivePath}`);
  }

  return resolvedPath;
}

export function resolveDerivedAbsolutePath(relativeDerivedPath: string, derivedRoot: string): string {
  const normalizedRelativePath = relativeDerivedPath.replace(/\\/g, '/').trim();
  if (normalizedRelativePath.length === 0) {
    throw new Error('Derived relative path must be non-empty.');
  }

  const absolutePath = path.resolve(derivedRoot, normalizedRelativePath);
  if (!absolutePath.startsWith(path.resolve(derivedRoot))) {
    throw new Error(`Derived path escaped TEDOGRAPHY_DERIVED_ROOT: ${relativeDerivedPath}`);
  }

  return absolutePath;
}

async function fileExists(absolutePath: string): Promise<boolean> {
  try {
    await fs.access(absolutePath);
    return true;
  } catch {
    return false;
  }
}

export async function getAnalysisSourceCandidates(
  asset: MediaAsset,
  storageRoots: StorageRootConfig[],
  derivedRoot: string | undefined
): Promise<AnalysisSourceCandidate[]> {
  const candidates: AnalysisSourceCandidate[] = [
    {
      type: 'original',
      path: resolveAssetSourcePath(asset, storageRoots),
      strategy: 'original',
      label: 'original'
    }
  ];

  if (!derivedRoot || derivedRoot.trim().length === 0) {
    return candidates;
  }

  const derivedCandidates: Array<{ relativePath: string; label: string }> = [];

  if (
    asset.displayStorageType === 'derived-root' &&
    (asset.displayFileFormat.toLowerCase() === 'jpg' ||
      asset.displayFileFormat.toLowerCase() === 'jpeg') &&
    typeof asset.displayDerivedPath === 'string' &&
    asset.displayDerivedPath.length > 0
  ) {
    derivedCandidates.push({
      relativePath: asset.displayDerivedPath,
      label: 'display-derived-jpeg'
    });
  }

  if (
    asset.thumbnailStorageType === 'derived-root' &&
    typeof asset.thumbnailFileFormat === 'string' &&
    (asset.thumbnailFileFormat.toLowerCase() === 'jpg' ||
      asset.thumbnailFileFormat.toLowerCase() === 'jpeg') &&
    typeof asset.thumbnailDerivedPath === 'string' &&
    asset.thumbnailDerivedPath.length > 0
  ) {
    derivedCandidates.push({
      relativePath: asset.thumbnailDerivedPath,
      label: 'thumbnail-derived-jpeg'
    });
  }

  const seenPaths = new Set<string>([candidates[0]?.path ?? '']);
  for (const derivedCandidate of derivedCandidates) {
    const absolutePath = resolveDerivedAbsolutePath(derivedCandidate.relativePath, derivedRoot);
    if (seenPaths.has(absolutePath)) {
      continue;
    }
    seenPaths.add(absolutePath);

    if (await fileExists(absolutePath)) {
      candidates.push({
        type: 'derived-jpeg',
        path: absolutePath,
        strategy: 'original-then-derived-jpeg-fallback',
        label: derivedCandidate.label
      });
    }
  }

  return candidates;
}

export async function getDerivedJpegReferences(
  asset: MediaAsset,
  derivedRoot: string | undefined
): Promise<DerivedJpegReference[]> {
  if (!derivedRoot || derivedRoot.trim().length === 0) {
    return [];
  }

  const references: DerivedJpegReference[] = [];

  if (
    asset.displayStorageType === 'derived-root' &&
    (asset.displayFileFormat.toLowerCase() === 'jpg' ||
      asset.displayFileFormat.toLowerCase() === 'jpeg') &&
    typeof asset.displayDerivedPath === 'string' &&
    asset.displayDerivedPath.length > 0
  ) {
    const absolutePath = resolveDerivedAbsolutePath(asset.displayDerivedPath, derivedRoot);
    references.push({
      kind: 'display-derived-jpeg',
      relativePath: asset.displayDerivedPath,
      absolutePath,
      exists: await fileExists(absolutePath)
    });
  }

  if (
    asset.thumbnailStorageType === 'derived-root' &&
    typeof asset.thumbnailFileFormat === 'string' &&
    (asset.thumbnailFileFormat.toLowerCase() === 'jpg' ||
      asset.thumbnailFileFormat.toLowerCase() === 'jpeg') &&
    typeof asset.thumbnailDerivedPath === 'string' &&
    asset.thumbnailDerivedPath.length > 0
  ) {
    const absolutePath = resolveDerivedAbsolutePath(asset.thumbnailDerivedPath, derivedRoot);
    references.push({
      kind: 'thumbnail-derived-jpeg',
      relativePath: asset.thumbnailDerivedPath,
      absolutePath,
      exists: await fileExists(absolutePath)
    });
  }

  return references;
}
