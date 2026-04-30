import type { AlbumTreeNode, SmartAlbum, SmartAlbumFilterSpec } from '@tedography/domain';
import { normalizePhotoState } from '@tedography/domain';
import { randomUUID } from 'node:crypto';
import { SmartAlbumModel } from '../models/smartAlbumModel.js';
import { findAlbumTreeNodeById } from './albumTreeRepository.js';
import { getKeywordById } from './keywordRepository.js';

export class SmartAlbumNotFoundError extends Error {
  constructor(id: string) {
    super(`Smart Album "${id}" was not found.`);
    this.name = 'SmartAlbumNotFoundError';
  }
}

export class SmartAlbumValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SmartAlbumValidationError';
  }
}

function isYearGroupNode(node: AlbumTreeNode | null): boolean {
  return Boolean(node && node.nodeType === 'Group' && /^\d{4}$/.test(node.label.trim()));
}

function normalizeStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const filtered = value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
  return filtered.length > 0 ? filtered : null;
}

function normalizeSmartAlbumRecord(item: SmartAlbum): SmartAlbum {
  return {
    ...item,
    filterSpec: {
      keywordId:
        typeof item.filterSpec.keywordId === 'string' && item.filterSpec.keywordId.trim().length > 0
          ? item.filterSpec.keywordId.trim()
          : null,
      photoState: item.filterSpec.photoState ?? null,
      yearGroupId:
        typeof item.filterSpec.yearGroupId === 'string' && item.filterSpec.yearGroupId.trim().length > 0
          ? item.filterSpec.yearGroupId.trim()
          : null,
      peopleIds: normalizeStringArray(item.filterSpec.peopleIds),
      peopleMatchMode: item.filterSpec.peopleMatchMode === 'All' ? 'All' : (item.filterSpec.peopleIds?.length ? 'Any' : null),
      excludedPeopleIds: normalizeStringArray(item.filterSpec.excludedPeopleIds),
      hasNoPeople: item.filterSpec.hasNoPeople === true ? true : null,
      captureDateFrom:
        typeof item.filterSpec.captureDateFrom === 'string' && item.filterSpec.captureDateFrom.trim().length > 0
          ? item.filterSpec.captureDateFrom.trim()
          : null,
      captureDateTo:
        typeof item.filterSpec.captureDateTo === 'string' && item.filterSpec.captureDateTo.trim().length > 0
          ? item.filterSpec.captureDateTo.trim()
          : null,
      captureDateAvailability: item.filterSpec.captureDateAvailability ?? null
    }
  };
}

async function normalizeAndValidateFilterSpec(
  filterSpec: SmartAlbumFilterSpec
): Promise<SmartAlbumFilterSpec> {
  const keywordId =
    typeof filterSpec.keywordId === 'string' && filterSpec.keywordId.trim().length > 0
      ? filterSpec.keywordId.trim()
      : null;
  const yearGroupId =
    typeof filterSpec.yearGroupId === 'string' && filterSpec.yearGroupId.trim().length > 0
      ? filterSpec.yearGroupId.trim()
      : null;
  const photoState =
    filterSpec.photoState !== undefined && filterSpec.photoState !== null
      ? normalizePhotoState(filterSpec.photoState)
      : null;

  if (filterSpec.photoState !== undefined && filterSpec.photoState !== null && !photoState) {
    throw new SmartAlbumValidationError('filterSpec.photoState must be one of New, Pending, Keep, Discard');
  }

  if (keywordId) {
    const keyword = await getKeywordById(keywordId);
    if (!keyword) {
      throw new SmartAlbumValidationError(`filterSpec.keywordId "${keywordId}" was not found.`);
    }
  }

  if (yearGroupId) {
    const yearGroup = await findAlbumTreeNodeById(yearGroupId);
    if (!isYearGroupNode(yearGroup)) {
      throw new SmartAlbumValidationError(
        `filterSpec.yearGroupId "${yearGroupId}" must reference an existing year group.`
      );
    }
  }

  const peopleIds = normalizeStringArray(filterSpec.peopleIds ?? null);
  const excludedPeopleIds = normalizeStringArray(filterSpec.excludedPeopleIds ?? null);
  const hasNoPeople = filterSpec.hasNoPeople === true ? true : null;
  const peopleMatchMode =
    filterSpec.peopleMatchMode === 'All' ? 'All' : (peopleIds?.length ? 'Any' : null);
  const captureDateFrom =
    typeof filterSpec.captureDateFrom === 'string' && filterSpec.captureDateFrom.trim().length > 0
      ? filterSpec.captureDateFrom.trim()
      : null;
  const captureDateTo =
    typeof filterSpec.captureDateTo === 'string' && filterSpec.captureDateTo.trim().length > 0
      ? filterSpec.captureDateTo.trim()
      : null;
  const validAvailabilityModes = ['datedOnly', 'datedOrUndated', 'undatedOnly'];
  const captureDateAvailability =
    typeof filterSpec.captureDateAvailability === 'string' &&
    validAvailabilityModes.includes(filterSpec.captureDateAvailability)
      ? filterSpec.captureDateAvailability
      : null;

  const hasAnyFilter =
    keywordId ||
    photoState ||
    yearGroupId ||
    (peopleIds?.length ?? 0) > 0 ||
    (excludedPeopleIds?.length ?? 0) > 0 ||
    hasNoPeople ||
    captureDateFrom ||
    captureDateTo ||
    (captureDateAvailability && captureDateAvailability !== 'datedOnly');

  if (!hasAnyFilter) {
    throw new SmartAlbumValidationError(
      'filterSpec must include at least one filter.'
    );
  }

  return {
    keywordId,
    photoState,
    yearGroupId,
    peopleIds,
    peopleMatchMode,
    excludedPeopleIds,
    hasNoPeople,
    captureDateFrom,
    captureDateTo,
    captureDateAvailability
  };
}

function normalizeLabel(label: string): string {
  const trimmed = label.trim().replace(/\s+/g, ' ');
  if (trimmed.length === 0) {
    throw new SmartAlbumValidationError('label is required');
  }

  return trimmed;
}

export async function syncSmartAlbumIndexes(): Promise<void> {
  await SmartAlbumModel.syncIndexes();
}

export async function createSmartAlbum(
  label: string,
  filterSpec: SmartAlbumFilterSpec
): Promise<SmartAlbum> {
  const normalizedLabel = normalizeLabel(label);
  const normalizedFilterSpec = await normalizeAndValidateFilterSpec(filterSpec);
  const now = new Date().toISOString();
  const smartAlbum: SmartAlbum = {
    id: randomUUID(),
    label: normalizedLabel,
    filterSpec: normalizedFilterSpec,
    createdAt: now,
    updatedAt: now
  };

  await SmartAlbumModel.create(smartAlbum);
  return normalizeSmartAlbumRecord(smartAlbum);
}

export async function listSmartAlbums(): Promise<SmartAlbum[]> {
  const items = await SmartAlbumModel.find({}, { _id: 0 })
    .sort({ label: 1, id: 1 })
    .lean<SmartAlbum[]>();
  return items.map(normalizeSmartAlbumRecord);
}

export async function getSmartAlbumById(id: string): Promise<SmartAlbum | null> {
  const item = await SmartAlbumModel.findOne({ id }, { _id: 0 }).lean<SmartAlbum | null>();
  return item ? normalizeSmartAlbumRecord(item) : null;
}

export async function updateSmartAlbum(
  id: string,
  input: { label?: string; filterSpec?: SmartAlbumFilterSpec }
): Promise<SmartAlbum> {
  const existing = await getSmartAlbumById(id);
  if (!existing) {
    throw new SmartAlbumNotFoundError(id);
  }

  const label = input.label !== undefined ? normalizeLabel(input.label) : existing.label;
  const filterSpec =
    input.filterSpec !== undefined
      ? await normalizeAndValidateFilterSpec(input.filterSpec)
      : existing.filterSpec;

  const updatedAt = new Date().toISOString();
  await SmartAlbumModel.updateOne(
    { id },
    {
      $set: {
        label,
        filterSpec,
        updatedAt
      }
    }
  );

  return {
    ...existing,
    label,
    filterSpec,
    updatedAt
  };
}

export async function deleteSmartAlbum(id: string): Promise<boolean> {
  const result = await SmartAlbumModel.deleteOne({ id });
  return result.deletedCount > 0;
}
