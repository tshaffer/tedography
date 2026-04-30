import type { Keyword, KeywordTreeNode } from '@tedography/domain';
import { randomUUID } from 'node:crypto';
import { KeywordModel } from '../models/keywordModel.js';
import { findById, removeKeywordsGlobally } from './assetRepository.js';

export class KeywordLabelConflictError extends Error {
  constructor(label: string) {
    super(`A keyword named "${label}" already exists.`);
    this.name = 'KeywordLabelConflictError';
  }
}

export class KeywordNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KeywordNotFoundError';
  }
}

export class KeywordParentNotFoundError extends Error {
  constructor(parentKeywordId: string) {
    super(`Parent keyword "${parentKeywordId}" was not found.`);
    this.name = 'KeywordParentNotFoundError';
  }
}

export class KeywordSelfParentError extends Error {
  constructor() {
    super('A keyword cannot be its own parent.');
    this.name = 'KeywordSelfParentError';
  }
}

export class KeywordHierarchyCycleError extends Error {
  constructor() {
    super('A keyword cannot be moved under one of its own descendants.');
    this.name = 'KeywordHierarchyCycleError';
  }
}

export function normalizeKeywordLabel(label: string): string {
  return label.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

function normalizeKeyword(keyword: Keyword): Keyword {
  return {
    ...keyword,
    parentKeywordId:
      typeof keyword.parentKeywordId === 'string' && keyword.parentKeywordId.trim().length > 0
        ? keyword.parentKeywordId.trim()
        : null
  };
}

function sortKeywordsByLabel(items: Keyword[]): Keyword[] {
  return [...items].sort((left, right) => {
    const labelCompare = left.label.localeCompare(right.label, undefined, { sensitivity: 'base' });
    if (labelCompare !== 0) {
      return labelCompare;
    }

    return left.id.localeCompare(right.id);
  });
}

async function resolveParentKeywordId(parentKeywordId?: string | null): Promise<string | null> {
  if (typeof parentKeywordId !== 'string' || parentKeywordId.trim().length === 0) {
    return null;
  }

  const normalizedParentKeywordId = parentKeywordId.trim();
  const parentKeyword = await getKeywordById(normalizedParentKeywordId);
  if (!parentKeyword) {
    throw new KeywordParentNotFoundError(normalizedParentKeywordId);
  }

  return parentKeyword.id;
}

export async function syncKeywordIndexes(): Promise<void> {
  await KeywordModel.syncIndexes();
}

export async function createKeyword(label: string, parentKeywordId?: string | null): Promise<Keyword> {
  const trimmedLabel = label.trim().replace(/\s+/g, ' ');
  const normalizedLabel = normalizeKeywordLabel(trimmedLabel);

  const existing = await getKeywordByNormalizedLabel(normalizedLabel);
  if (existing) {
    throw new KeywordLabelConflictError(trimmedLabel);
  }

  const resolvedParentKeywordId = await resolveParentKeywordId(parentKeywordId);

  const now = new Date().toISOString();
  const keyword: Keyword = {
    id: randomUUID(),
    label: trimmedLabel,
    normalizedLabel,
    parentKeywordId: resolvedParentKeywordId,
    createdAt: now,
    updatedAt: now
  };

  await KeywordModel.create(keyword);
  return normalizeKeyword(keyword);
}

export async function listKeywords(): Promise<Keyword[]> {
  const items = await KeywordModel.find({}, { _id: 0 })
    .sort({ label: 1, id: 1 })
    .lean<Keyword[]>();

  return items.map(normalizeKeyword);
}

export async function getKeywordById(id: string): Promise<Keyword | null> {
  const keyword = await KeywordModel.findOne({ id }, { _id: 0 }).lean<Keyword | null>();
  return keyword ? normalizeKeyword(keyword) : null;
}

export async function getKeywordByNormalizedLabel(
  normalizedLabel: string
): Promise<Keyword | null> {
  const keyword = await KeywordModel.findOne({ normalizedLabel }, { _id: 0 }).lean<Keyword | null>();
  return keyword ? normalizeKeyword(keyword) : null;
}

export async function findKeywordsByIds(ids: string[]): Promise<Keyword[]> {
  if (ids.length === 0) {
    return [];
  }

  const items = await KeywordModel.find({ id: { $in: ids } }, { _id: 0 })
    .sort({ label: 1, id: 1 })
    .lean<Keyword[]>();

  return items.map(normalizeKeyword);
}

export async function getKeywordChildren(parentKeywordId: string | null): Promise<Keyword[]> {
  const parentId = typeof parentKeywordId === 'string' && parentKeywordId.trim().length > 0
    ? parentKeywordId.trim()
    : null;
  const query = parentId ? { parentKeywordId: parentId } : { $or: [{ parentKeywordId: null }, { parentKeywordId: { $exists: false } }] };
  const items = await KeywordModel.find(query, { _id: 0 })
    .sort({ label: 1, id: 1 })
    .lean<Keyword[]>();

  return items.map(normalizeKeyword);
}

function buildKeywordTree(items: Keyword[]): KeywordTreeNode[] {
  const normalizedItems = items.map(normalizeKeyword);
  const keywordIdSet = new Set(normalizedItems.map((keyword) => keyword.id));
  const byParent = new Map<string | null, Keyword[]>();

  for (const keyword of sortKeywordsByLabel(normalizedItems)) {
    const parentId =
      keyword.parentKeywordId && keywordIdSet.has(keyword.parentKeywordId)
        ? keyword.parentKeywordId
        : null;
    const siblings = byParent.get(parentId);
    if (siblings) {
      siblings.push(keyword);
    } else {
      byParent.set(parentId, [keyword]);
    }
  }

  function buildNodes(parentId: string | null): KeywordTreeNode[] {
    return (byParent.get(parentId) ?? []).map((keyword) => ({
      id: keyword.id,
      label: keyword.label,
      normalizedLabel: keyword.normalizedLabel,
      parentKeywordId: keyword.parentKeywordId ?? null,
      children: buildNodes(keyword.id),
      createdAt: keyword.createdAt,
      updatedAt: keyword.updatedAt
    }));
  }

  return buildNodes(null);
}

export async function listKeywordsAsTree(): Promise<KeywordTreeNode[]> {
  return buildKeywordTree(await listKeywords());
}

function collectDescendantIds(allKeywords: Keyword[], keywordId: string): Set<string> {
  const descendants = new Set<string>();
  const queue = [keywordId];

  while (queue.length > 0) {
    const currentKeywordId = queue.shift();
    if (!currentKeywordId) {
      continue;
    }

    for (const keyword of allKeywords) {
      if (keyword.parentKeywordId === currentKeywordId && !descendants.has(keyword.id)) {
        descendants.add(keyword.id);
        queue.push(keyword.id);
      }
    }
  }

  return descendants;
}

export async function updateKeywordParent(
  keywordId: string,
  parentKeywordId: string | null
): Promise<Keyword> {
  const keyword = await getKeywordById(keywordId);
  if (!keyword) {
    throw new KeywordNotFoundError(`Keyword "${keywordId}" was not found.`);
  }

  if (typeof parentKeywordId === 'string' && parentKeywordId.trim().length > 0) {
    const normalizedParentKeywordId = parentKeywordId.trim();
    if (normalizedParentKeywordId === keyword.id) {
      throw new KeywordSelfParentError();
    }

    const parentKeyword = await getKeywordById(normalizedParentKeywordId);
    if (!parentKeyword) {
      throw new KeywordParentNotFoundError(normalizedParentKeywordId);
    }

    const allKeywords = await listKeywords();
    const descendantIds = collectDescendantIds(allKeywords, keyword.id);
    if (descendantIds.has(normalizedParentKeywordId)) {
      throw new KeywordHierarchyCycleError();
    }

    const updatedAt = new Date().toISOString();
    await KeywordModel.updateOne(
      { id: keyword.id },
      { $set: { parentKeywordId: normalizedParentKeywordId, updatedAt } }
    );

    return {
      ...keyword,
      parentKeywordId: normalizedParentKeywordId,
      updatedAt
    };
  }

  const updatedAt = new Date().toISOString();
  await KeywordModel.updateOne(
    { id: keyword.id },
    { $set: { parentKeywordId: null, updatedAt } }
  );

  return {
    ...keyword,
    parentKeywordId: null,
    updatedAt
  };
}

export async function updateKeywordLabel(
  keywordId: string,
  label: string
): Promise<Keyword> {
  const keyword = await getKeywordById(keywordId);
  if (!keyword) {
    throw new KeywordNotFoundError(`Keyword "${keywordId}" was not found.`);
  }

  const trimmedLabel = label.trim().replace(/\s+/g, ' ');
  const normalizedLabel = normalizeKeywordLabel(trimmedLabel);

  const existing = await getKeywordByNormalizedLabel(normalizedLabel);
  if (existing && existing.id !== keyword.id) {
    throw new KeywordLabelConflictError(trimmedLabel);
  }

  if (keyword.label === trimmedLabel && keyword.normalizedLabel === normalizedLabel) {
    return keyword;
  }

  const updatedAt = new Date().toISOString();
  await KeywordModel.updateOne(
    { id: keyword.id },
    { $set: { label: trimmedLabel, normalizedLabel, updatedAt } }
  );

  return {
    ...keyword,
    label: trimmedLabel,
    normalizedLabel,
    updatedAt
  };
}

export async function deleteKeyword(keywordId: string): Promise<string[]> {
  const keyword = await getKeywordById(keywordId);
  if (!keyword) {
    throw new KeywordNotFoundError(`Keyword "${keywordId}" was not found.`);
  }

  const allKeywords = await listKeywords();
  const descendantIds = collectDescendantIds(allKeywords, keywordId);
  const idsToDelete = [keywordId, ...descendantIds];

  await removeKeywordsGlobally(idsToDelete);
  await KeywordModel.deleteMany({ id: { $in: idsToDelete } });

  return idsToDelete;
}

export async function listKeywordsForAsset(assetId: string): Promise<Keyword[] | null> {
  const asset = await findById(assetId);
  if (!asset) {
    return null;
  }

  return findKeywordsByIds(asset.keywordIds ?? []);
}
