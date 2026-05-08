import fs from 'node:fs';
import { config, type StorageRootConfig } from '../config.js';

export type StorageRootWithAvailability = StorageRootConfig & {
  isAvailable: boolean;
};

const AI_QUEUE_ROOT_ID = 'ai-queue';

function allRoots(): StorageRootConfig[] {
  const roots = [...config.storageRoots];
  if (config.aiQueueExportPath) {
    roots.push({ id: AI_QUEUE_ROOT_ID, label: 'AI Import Queue', absolutePath: config.aiQueueExportPath });
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
