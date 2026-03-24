import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';

function normalizeDerivedRelativePath(relativeDerivedPath: string): string {
  const normalized = relativeDerivedPath.replace(/\\/g, '/').trim();
  if (normalized.length === 0) {
    throw new Error('relativeDerivedPath must be non-empty');
  }

  if (normalized.includes('\0')) {
    throw new Error('relativeDerivedPath contains a null byte');
  }

  const segments = normalized
    .split('/')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0 && segment !== '.');

  if (segments.length === 0) {
    throw new Error('relativeDerivedPath must be non-empty');
  }

  if (segments.some((segment) => segment === '..')) {
    throw new Error('relativeDerivedPath traversal is not allowed');
  }

  return segments.join('/');
}

export function buildDisplayJpegDerivedRelativePath(originalContentHash: string): string {
  const normalizedHash = originalContentHash.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalizedHash)) {
    throw new Error('originalContentHash must be a SHA-256 hex string');
  }

  return `display-jpegs/${normalizedHash}.jpg`;
}

export function buildThumbnailDerivedRelativePath(originalContentHash: string): string {
  const normalizedHash = originalContentHash.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalizedHash)) {
    throw new Error('originalContentHash must be a SHA-256 hex string');
  }

  return `thumbnails/${normalizedHash}.jpg`;
}

export function buildPeopleFaceCropDerivedRelativePath(input: {
  originalContentHash: string;
  pipelineVersion: string;
  faceIndex: number;
}): string {
  const normalizedHash = input.originalContentHash.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalizedHash)) {
    throw new Error('originalContentHash must be a SHA-256 hex string');
  }

  const normalizedPipelineVersion = input.pipelineVersion.trim();
  if (normalizedPipelineVersion.length === 0) {
    throw new Error('pipelineVersion must be non-empty');
  }

  if (!Number.isInteger(input.faceIndex) || input.faceIndex < 0) {
    throw new Error('faceIndex must be a non-negative integer');
  }

  return `people-faces/${normalizedPipelineVersion}/${normalizedHash}/face-${String(input.faceIndex).padStart(3, '0')}.jpg`;
}

export function resolveDerivedAbsolutePath(relativeDerivedPath: string): string {
  const normalizedRelativePath = normalizeDerivedRelativePath(relativeDerivedPath);
  const absolutePath = path.resolve(config.derivedRoot, normalizedRelativePath);
  const relativeToRoot = path.relative(config.derivedRoot, absolutePath);

  if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
    throw new Error('relativeDerivedPath resolves outside TEDOGRAPHY_DERIVED_ROOT');
  }

  return absolutePath;
}

export async function ensureParentDirectoryExistsForDerivedPath(
  relativeDerivedPath: string
): Promise<void> {
  const absolutePath = resolveDerivedAbsolutePath(relativeDerivedPath);
  const parentDirectory = path.dirname(absolutePath);
  await fs.mkdir(parentDirectory, { recursive: true });
}
