import type { KeywordChangeAction, KeywordChangeEvent } from '@tedography/domain';
import { randomUUID } from 'node:crypto';
import { KeywordChangeEventModel } from '../models/keywordChangeEventModel.js';

function toKeywordChangeEvent(doc: KeywordChangeEvent): KeywordChangeEvent {
  return {
    id: doc.id,
    assetId: doc.assetId,
    keywordId: doc.keywordId,
    action: doc.action,
    changedAt: doc.changedAt
  };
}

export async function recordKeywordChanges(
  assetIds: string[],
  keywordIds: string[],
  action: KeywordChangeAction
): Promise<void> {
  if (assetIds.length === 0 || keywordIds.length === 0) {
    return;
  }

  const now = new Date().toISOString();
  const events = assetIds.flatMap((assetId) =>
    keywordIds.map((keywordId) => ({
      id: randomUUID(),
      assetId,
      keywordId,
      action,
      changedAt: now
    }))
  );

  await KeywordChangeEventModel.insertMany(events);
}

export async function listKeywordChangesSince(since: string): Promise<KeywordChangeEvent[]> {
  const docs = await KeywordChangeEventModel.find({ changedAt: { $gt: since } })
    .sort({ changedAt: 1 })
    .lean<KeywordChangeEvent[]>();

  return docs.map(toKeywordChangeEvent);
}

export async function syncKeywordChangeEventIndexes(): Promise<void> {
  await KeywordChangeEventModel.syncIndexes();
}
