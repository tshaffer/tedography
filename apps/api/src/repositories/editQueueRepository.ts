import { randomUUID } from 'node:crypto';
import { EditType, type EditQueueEntry } from '@tedography/domain';
import { EditQueueEntryModel } from '../models/editQueueEntryModel.js';

export interface EditQueueEntryWithFilename extends EditQueueEntry {
  filename: string;
}

function normalize(doc: EditQueueEntry): EditQueueEntry {
  return {
    id: doc.id,
    assetId: doc.assetId,
    note: doc.note,
    editType: doc.editType ?? EditType.Unspecified,
    createdAt: doc.createdAt,
    editedAssetId: doc.editedAssetId ?? null,
  };
}

export async function getQueueEntries(): Promise<EditQueueEntry[]> {
  const docs = await EditQueueEntryModel.find().sort({ createdAt: 1 }).lean<EditQueueEntry[]>();
  return docs.map(normalize);
}

export async function upsertQueueEntry(assetId: string, note: string): Promise<EditQueueEntry> {
  const existing = await EditQueueEntryModel.findOne({ assetId }).lean<EditQueueEntry>();
  if (existing) {
    await EditQueueEntryModel.updateOne({ assetId }, { note });
    return { ...normalize(existing), note };
  }
  const entry: EditQueueEntry = {
    id: randomUUID(),
    assetId,
    note,
    editType: EditType.Unspecified,
    createdAt: new Date().toISOString(),
  };
  await EditQueueEntryModel.create(entry);
  return entry;
}

export async function updateQueueEntryEditType(assetId: string, editType: EditType): Promise<void> {
  await EditQueueEntryModel.updateOne({ assetId }, { editType });
}

export async function removeQueueEntry(assetId: string): Promise<void> {
  await EditQueueEntryModel.deleteOne({ assetId });
}

export async function clearQueue(): Promise<void> {
  await EditQueueEntryModel.deleteMany({});
}
