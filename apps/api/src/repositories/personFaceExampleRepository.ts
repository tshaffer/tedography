import { randomUUID } from 'node:crypto';
import type { PersonFaceExample } from '@tedography/domain';
import { log } from '../logger.js';
import { PersonFaceExampleModel } from '../models/personFaceExampleModel.js';

function normalizeOptionalIsoDate(value: unknown): string | undefined {
  return value instanceof Date ? value.toISOString() : typeof value === 'string' ? value : undefined;
}

function normalizePersonFaceExample(item: PersonFaceExample): PersonFaceExample {
  const createdAt = normalizeOptionalIsoDate((item as { createdAt?: unknown }).createdAt);
  const updatedAt = normalizeOptionalIsoDate((item as { updatedAt?: unknown }).updatedAt);
  return {
    ...item,
    ...(createdAt !== undefined ? { createdAt } : {}),
    ...(updatedAt !== undefined ? { updatedAt } : {})
  };
}

export async function syncPersonFaceExampleIndexes(): Promise<void> {
  await PersonFaceExampleModel.syncIndexes();
  log.info('Synchronized personFaceExamples indexes');
}

export async function listActivePersonFaceExamplesByPersonId(personId: string): Promise<PersonFaceExample[]> {
  const items = await PersonFaceExampleModel.find({ personId, status: 'active' }, { _id: 0 })
    .sort({ createdAt: -1, id: -1 })
    .lean<PersonFaceExample[]>();
  return items.map(normalizePersonFaceExample);
}

export async function countActivePersonFaceExamplesByPersonIds(personIds: string[]): Promise<Record<string, number>> {
  if (personIds.length === 0) {
    return {};
  }

  const grouped = await PersonFaceExampleModel.aggregate<{ _id: string; count: number }>([
    { $match: { personId: { $in: personIds }, status: 'active' } },
    { $group: { _id: '$personId', count: { $sum: 1 } } }
  ]);

  const counts: Record<string, number> = {};
  for (const item of grouped) {
    counts[item._id] = item.count;
  }
  return counts;
}

export async function findActivePersonFaceExampleByPersonAndDetection(input: {
  personId: string;
  faceDetectionId: string;
}): Promise<PersonFaceExample | null> {
  const item = await PersonFaceExampleModel.findOne(
    { personId: input.personId, faceDetectionId: input.faceDetectionId, status: 'active' },
    { _id: 0 }
  ).lean<PersonFaceExample | null>();
  return item ? normalizePersonFaceExample(item) : null;
}

export async function findPersonFaceExampleById(id: string): Promise<PersonFaceExample | null> {
  const item = await PersonFaceExampleModel.findOne({ id }, { _id: 0 }).lean<PersonFaceExample | null>();
  return item ? normalizePersonFaceExample(item) : null;
}

export async function createPersonFaceExample(input: {
  personId: string;
  faceDetectionId: string;
  mediaAssetId: string;
  engine: string;
  subjectKey?: string | null;
  engineExampleId?: string | null;
}): Promise<PersonFaceExample> {
  const id = randomUUID();
  await PersonFaceExampleModel.create({
    id,
    personId: input.personId,
    faceDetectionId: input.faceDetectionId,
    mediaAssetId: input.mediaAssetId,
    engine: input.engine,
    subjectKey: input.subjectKey ?? null,
    engineExampleId: input.engineExampleId ?? null,
    status: 'active',
    removedAt: null
  });

  const item = await findPersonFaceExampleById(id);
  if (!item) {
    throw new Error(`Failed to load newly created person face example: ${id}`);
  }
  return item;
}

export async function markPersonFaceExampleRemoved(id: string): Promise<PersonFaceExample | null> {
  const removedAt = new Date().toISOString();
  const item = await PersonFaceExampleModel.findOneAndUpdate(
    { id },
    { $set: { status: 'removed', removedAt } },
    { new: true, projection: { _id: 0 }, runValidators: true }
  ).lean<PersonFaceExample | null>();
  return item ? normalizePersonFaceExample(item) : null;
}
