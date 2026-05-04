import { randomUUID } from 'node:crypto';
import type { AiEditQueueEntry } from '@tedography/domain';
import { AiEditQueueEntryModel } from '../models/aiEditQueueEntryModel.js';

export interface AiEditQueueEntryWithFilename extends AiEditQueueEntry {
  filename: string;
}

function normalize(doc: AiEditQueueEntry): AiEditQueueEntry {
  return {
    id: doc.id,
    assetId: doc.assetId,
    prompt: doc.prompt,
    createdAt: doc.createdAt,
  };
}

export async function getQueueEntries(): Promise<AiEditQueueEntry[]> {
  const docs = await AiEditQueueEntryModel.find().sort({ createdAt: 1 }).lean<AiEditQueueEntry[]>();
  return docs.map(normalize);
}

export async function upsertQueueEntry(assetId: string, prompt: string): Promise<AiEditQueueEntry> {
  const existing = await AiEditQueueEntryModel.findOne({ assetId }).lean<AiEditQueueEntry>();
  if (existing) {
    await AiEditQueueEntryModel.updateOne({ assetId }, { prompt });
    return { ...normalize(existing), prompt };
  }
  const entry: AiEditQueueEntry = {
    id: randomUUID(),
    assetId,
    prompt,
    createdAt: new Date().toISOString(),
  };
  await AiEditQueueEntryModel.create(entry);
  return entry;
}

export async function removeQueueEntry(assetId: string): Promise<void> {
  await AiEditQueueEntryModel.deleteOne({ assetId });
}

export async function clearQueue(): Promise<void> {
  await AiEditQueueEntryModel.deleteMany({});
}
