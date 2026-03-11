import path from 'node:path';
import type { StorageRootConfig } from '../config.js';

function ensureNoNullByte(value: string): void {
  if (value.includes('\0')) {
    throw new Error('relativePath contains a null byte');
  }
}

export function normalizeRelativePath(relativePath?: string): string {
  const raw = (relativePath ?? '').trim();
  ensureNoNullByte(raw);

  if (raw === '' || raw === '.' || raw === '/' || raw === './') {
    return '';
  }

  const slashNormalized = raw.replace(/\\/g, '/');
  const segments = slashNormalized
    .split('/')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0 && segment !== '.');

  if (segments.some((segment) => segment === '..')) {
    throw new Error('relativePath traversal is not allowed');
  }

  return segments.join('/');
}

export function resolveSafeAbsolutePath(root: StorageRootConfig, relativePath?: string): string {
  const normalizedRelativePath = normalizeRelativePath(relativePath);
  const absolutePath = path.resolve(root.absolutePath, normalizedRelativePath);

  const relativeToRoot = path.relative(root.absolutePath, absolutePath);
  if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
    throw new Error('relativePath resolves outside the storage root');
  }

  return absolutePath;
}

export function getParentRelativePath(relativePath: string): string | null {
  const normalized = normalizeRelativePath(relativePath);
  if (normalized === '') {
    return null;
  }

  const lastSlashIndex = normalized.lastIndexOf('/');
  if (lastSlashIndex < 0) {
    return '';
  }

  return normalized.slice(0, lastSlashIndex);
}
