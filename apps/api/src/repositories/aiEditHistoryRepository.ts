import { randomUUID } from 'node:crypto';
import type { AiEditHistoryEntry } from '@tedography/domain';
import { AiEditHistoryModel } from '../models/aiEditHistoryModel.js';

export interface CreateHistoryEntryInput {
  sourceAssetId: string;
  sourceFilename: string;
  prompt: string;
  generatedFilename: string;
  status: 'succeeded' | 'failed';
  errorMessage: string | null;
}

export async function createHistoryEntry(input: CreateHistoryEntryInput): Promise<AiEditHistoryEntry> {
  const entry: AiEditHistoryEntry = {
    id: randomUUID(),
    sourceAssetId: input.sourceAssetId,
    sourceFilename: input.sourceFilename,
    prompt: input.prompt,
    generatedFilename: input.generatedFilename,
    generatedAssetId: null,
    status: input.status,
    errorMessage: input.errorMessage,
    processedAt: new Date().toISOString(),
  };
  await AiEditHistoryModel.create(entry);
  return entry;
}

export async function getHistoryEntries(limit = 200): Promise<AiEditHistoryEntry[]> {
  return AiEditHistoryModel
    .find()
    .sort({ processedAt: -1 })
    .limit(limit)
    .lean<AiEditHistoryEntry[]>();
}

export async function linkGeneratedAsset(
  sourceAssetId: string,
  generatedFilename: string,
  generatedAssetId: string
): Promise<void> {
  await AiEditHistoryModel.findOneAndUpdate(
    { sourceAssetId, generatedFilename, generatedAssetId: null, status: 'succeeded' },
    { $set: { generatedAssetId } },
    { sort: { processedAt: -1 } }
  );
}
