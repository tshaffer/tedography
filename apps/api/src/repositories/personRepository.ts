import { randomUUID } from 'node:crypto';
import type { Person } from '@tedography/domain';
import { log } from '../logger.js';
import { PersonModel } from '../models/personModel.js';

function normalizeOptionalIsoDate(value: unknown): string | undefined {
  return value instanceof Date ? value.toISOString() : typeof value === 'string' ? value : undefined;
}

function normalizePerson(person: Person): Person {
  const createdAt = normalizeOptionalIsoDate((person as { createdAt?: unknown }).createdAt);
  const updatedAt = normalizeOptionalIsoDate((person as { updatedAt?: unknown }).updatedAt);
  return {
    ...person,
    ...(createdAt !== undefined ? { createdAt } : {}),
    ...(updatedAt !== undefined ? { updatedAt } : {})
  };
}

export async function syncPersonIndexes(): Promise<void> {
  await PersonModel.syncIndexes();
  log.info('Synchronized people indexes');
}

export async function listPeople(): Promise<Person[]> {
  const people = await PersonModel.find({}, { _id: 0 })
    .sort({ displayName: 1, id: 1 })
    .lean<Person[]>();
  return people.map(normalizePerson);
}

export async function findPeopleByIds(ids: string[]): Promise<Person[]> {
  if (ids.length === 0) {
    return [];
  }

  const people = await PersonModel.find({ id: { $in: ids } }, { _id: 0 })
    .sort({ displayName: 1, id: 1 })
    .lean<Person[]>();
  return people.map(normalizePerson);
}

export async function findPersonById(id: string): Promise<Person | null> {
  const person = await PersonModel.findOne({ id }, { _id: 0 }).lean<Person | null>();
  return person ? normalizePerson(person) : null;
}

export async function createPerson(input: {
  displayName: string;
  sortName?: string | null;
  aliases?: string[];
  notes?: string | null;
}): Promise<Person> {
  const id = randomUUID();
  await PersonModel.create({
    id,
    displayName: input.displayName.trim(),
    sortName: input.sortName?.trim() || null,
    aliases: [...new Set((input.aliases ?? []).map((value) => value.trim()).filter(Boolean))],
    notes: input.notes?.trim() || null,
    isHidden: false,
    isArchived: false
  });

  const person = await findPersonById(id);
  if (!person) {
    throw new Error(`Failed to load newly created person: ${id}`);
  }

  return person;
}

export async function updatePerson(input: {
  id: string;
  displayName?: string;
  isHidden?: boolean;
  isArchived?: boolean;
}): Promise<Person | null> {
  const update: Record<string, unknown> = {};

  if (input.displayName !== undefined) {
    update.displayName = input.displayName.trim();
  }

  if (input.isHidden !== undefined) {
    update.isHidden = input.isHidden;
  }

  if (input.isArchived !== undefined) {
    update.isArchived = input.isArchived;
  }

  if (Object.keys(update).length === 0) {
    return findPersonById(input.id);
  }

  const person = await PersonModel.findOneAndUpdate(
    { id: input.id },
    { $set: update },
    { returnDocument: 'after', projection: { _id: 0 }, runValidators: true }
  ).lean<Person | null>();
  return person ? normalizePerson(person) : null;
}
