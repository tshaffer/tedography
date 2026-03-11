import fs from 'node:fs';
import { config, type StorageRootConfig } from '../config.js';

export type StorageRootWithAvailability = StorageRootConfig & {
  isAvailable: boolean;
};

export function getStorageRoots(): StorageRootWithAvailability[] {
  return config.storageRoots.map((root) => ({
    ...root,
    isAvailable: fs.existsSync(root.absolutePath)
  }));
}

export function getStorageRootById(rootId: string): StorageRootConfig | null {
  return config.storageRoots.find((root) => root.id === rootId) ?? null;
}
