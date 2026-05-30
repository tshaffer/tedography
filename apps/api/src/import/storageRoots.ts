import fs from 'node:fs';
import { config, type StorageRootConfig } from '../config.js';

export type StorageRootWithAvailability = StorageRootConfig & {
  isAvailable: boolean;
};

const EDIT_QUEUE_ROOT_ID = 'edit-queue';

function allRoots(): StorageRootConfig[] {
  const roots = [...config.storageRoots];
  if (config.editPath) {
    roots.push({ id: EDIT_QUEUE_ROOT_ID, label: 'Edit Queue', absolutePath: config.editPath });
  }
  return roots;
}

export function getStorageRoots(): StorageRootWithAvailability[] {
  return allRoots().map((root) => ({
    ...root,
    isAvailable: fs.existsSync(root.absolutePath)
  }));
}

export function getStorageRootById(rootId: string): StorageRootConfig | null {
  return allRoots().find((root) => root.id === rootId) ?? null;
}
