import { randomUUID } from 'node:crypto';
import type { EditHistoryArchive } from '@tedography/domain';
import { EditHistoryArchiveModel } from '../models/editHistoryArchiveModel.js';

function defaultArchiveName(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

export async function createArchive(name: string | undefined, itemCount: number): Promise<EditHistoryArchive> {
  const archive: EditHistoryArchive = {
    id: randomUUID(),
    name: name?.trim() || defaultArchiveName(),
    createdAt: new Date().toISOString(),
    itemCount,
  };
  await EditHistoryArchiveModel.create(archive);
  return archive;
}

export async function getArchives(): Promise<EditHistoryArchive[]> {
  return EditHistoryArchiveModel
    .find()
    .sort({ createdAt: -1 })
    .lean<EditHistoryArchive[]>();
}

export async function getArchiveById(id: string): Promise<EditHistoryArchive | null> {
  return EditHistoryArchiveModel.findOne({ id }).lean<EditHistoryArchive>();
}

export async function renameArchive(id: string, name: string): Promise<void> {
  await EditHistoryArchiveModel.updateOne({ id }, { $set: { name: name.trim() } });
}

export async function incrementArchiveItemCount(id: string, delta: number): Promise<void> {
  await EditHistoryArchiveModel.updateOne({ id }, { $inc: { itemCount: delta } });
}

export async function deleteArchive(id: string): Promise<void> {
  await EditHistoryArchiveModel.deleteOne({ id });
}
