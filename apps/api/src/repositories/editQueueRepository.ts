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

export interface BulkUpsertResult {
  added: string[];
  skipped: string[];
}

/**
 * Adds a queue entry for each asset id that isn't already queued, giving every
 * new entry the same note and edit type. Assets already in the queue are left
 * untouched and reported in `skipped` — bulk add never overwrites an existing
 * note or type.
 */
export async function bulkUpsertQueueEntries(
  assetIds: string[],
  note: string,
  editType: EditType
): Promise<BulkUpsertResult> {
  const uniqueIds = Array.from(new Set(assetIds));
  const existing = await EditQueueEntryModel.find({ assetId: { $in: uniqueIds } })
    .select('assetId')
    .lean<{ assetId: string }[]>();
  const existingIds = new Set(existing.map((e) => e.assetId));

  const toAdd = uniqueIds.filter((assetId) => !existingIds.has(assetId));
  if (toAdd.length > 0) {
    const createdAt = new Date().toISOString();
    await EditQueueEntryModel.insertMany(
      toAdd.map((assetId) => ({
        id: randomUUID(),
        assetId,
        note,
        editType,
        createdAt,
      }))
    );
  }

  return {
    added: toAdd,
    skipped: uniqueIds.filter((assetId) => existingIds.has(assetId)),
  };
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
