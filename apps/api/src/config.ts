import 'dotenv/config';
import path from 'node:path';

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `[config] Missing required environment variable: ${name}`
    );
  }

  return value;
}

function requireNonEmpty(value: string, fieldName: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(`[config] Invalid TEDOGRAPHY_STORAGE_ROOTS entry: ${fieldName} must be non-empty`);
  }

  return trimmed;
}

export interface StorageRootConfig {
  id: string;
  label: string;
  absolutePath: string;
}

function parseStorageRoots(value: string | undefined): StorageRootConfig[] {
  if (!value || value.trim().length === 0) {
    return [];
  }

  const entries = value
    .split(';')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  const roots: StorageRootConfig[] = [];
  const seenIds = new Set<string>();

  for (const entry of entries) {
    const parts = entry.split('|');
    if (parts.length !== 3) {
      throw new Error(
        `[config] Invalid TEDOGRAPHY_STORAGE_ROOTS entry: expected id|label|absolutePath, got "${entry}"`
      );
    }

    const [rawId, rawLabel, rawAbsolutePath] = parts;
    const id = requireNonEmpty(rawId ?? '', 'id');
    const label = requireNonEmpty(rawLabel ?? '', 'label');
    const absolutePath = requireNonEmpty(rawAbsolutePath ?? '', 'absolutePath');

    if (!path.isAbsolute(absolutePath)) {
      throw new Error(
        `[config] Invalid TEDOGRAPHY_STORAGE_ROOTS entry for id "${id}": absolutePath must be absolute`
      );
    }

    if (seenIds.has(id)) {
      throw new Error(`[config] Duplicate TEDOGRAPHY_STORAGE_ROOTS id: "${id}"`);
    }

    seenIds.add(id);
    roots.push({ id, label, absolutePath });
  }

  return roots;
}

export const config = {
  mongoUri: requireEnv('MONGODB_URI'),
  importRoot: process.env.TEDOGRAPHY_IMPORT_ROOT,
  storageRoots: parseStorageRoots(process.env.TEDOGRAPHY_STORAGE_ROOTS),

  port: Number(process.env.PORT ?? 4000),
};
