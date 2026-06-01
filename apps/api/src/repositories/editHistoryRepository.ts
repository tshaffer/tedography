import { randomUUID } from 'node:crypto';
import type { EditHistoryEntry } from '@tedography/domain';
import { EditHistoryModel } from '../models/editHistoryModel.js';

export interface CreateEditHistoryEntryInput {
  sourceAssetId: string;
  sourceFilename: string;
  note: string;
  editedFilename: string;
  status: 'succeeded' | 'failed';
  errorMessage: string | null;
  editedAssetId?: string | null;
}

export async function createEditHistoryEntry(input: CreateEditHistoryEntryInput): Promise<EditHistoryEntry> {
  const entry: EditHistoryEntry = {
    id: randomUUID(),
    sourceAssetId: input.sourceAssetId,
    sourceFilename: input.sourceFilename,
    note: input.note,
    editedFilename: input.editedFilename,
    editedAssetId: input.editedAssetId ?? null,
    status: input.status,
    errorMessage: input.errorMessage,
    processedAt: new Date().toISOString(),
  };
  await EditHistoryModel.create(entry);
  return entry;
}

export async function getHistoryEntries(limit = 200): Promise<EditHistoryEntry[]> {
  return EditHistoryModel
    .find({ archiveId: null })
    .sort({ processedAt: -1 })
    .limit(limit)
    .lean<EditHistoryEntry[]>();
}

export async function getEntriesByArchiveId(archiveId: string): Promise<EditHistoryEntry[]> {
  return EditHistoryModel
    .find({ archiveId })
    .sort({ processedAt: -1 })
    .lean<EditHistoryEntry[]>();
}

export async function archiveEntries(entryIds: string[], archiveId: string): Promise<number> {
  const result = await EditHistoryModel.updateMany(
    { id: { $in: entryIds }, archiveId: null },
    { $set: { archiveId } }
  );
  return result.modifiedCount;
}

export async function deleteEntriesByArchiveId(archiveId: string): Promise<void> {
  await EditHistoryModel.deleteMany({ archiveId });
}

export async function linkEditedAsset(
  sourceAssetId: string,
  editedFilename: string,
  editedAssetId: string
): Promise<void> {
  await EditHistoryModel.findOneAndUpdate(
    { sourceAssetId, editedFilename, editedAssetId: null, status: 'succeeded' },
    { $set: { editedAssetId } },
    { sort: { processedAt: -1 } }
  );
}
