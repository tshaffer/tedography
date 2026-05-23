import { randomUUID } from 'node:crypto';
import type { TedographyUser } from '@tedography/domain';
import { log } from '../logger.js';
import { UserModel, type UserDoc } from '../models/userModel.js';

function normalizeOptionalIsoDate(value: unknown): string | undefined {
  return value instanceof Date
    ? value.toISOString()
    : typeof value === 'string'
    ? value
    : undefined;
}

/** Strip pinHash and normalize dates — safe to return to clients */
function toPublicUser(doc: UserDoc): TedographyUser {
  const createdAt =
    normalizeOptionalIsoDate((doc as { createdAt?: unknown }).createdAt) ??
    new Date().toISOString();
  return { id: doc.id, name: doc.name, roleId: doc.roleId, createdAt };
}

export async function syncUserIndexes(): Promise<void> {
  await UserModel.syncIndexes();
  log.info('Synchronized user indexes');
}

export async function listUsers(): Promise<TedographyUser[]> {
  const docs = await UserModel.find({}, { _id: 0, pinHash: 0 })
    .sort({ name: 1 })
    .lean<UserDoc[]>();
  return docs.map(toPublicUser);
}

export async function findUserById(id: string): Promise<TedographyUser | null> {
  const doc = await UserModel.findOne({ id }, { _id: 0, pinHash: 0 }).lean<UserDoc | null>();
  return doc ? toPublicUser(doc) : null;
}

/** Returns the raw doc including pinHash — only for auth service use */
export async function findUserDocById(id: string): Promise<UserDoc | null> {
  const doc = await UserModel.findOne({ id }, { _id: 0 }).lean<UserDoc | null>();
  return doc ?? null;
}

export async function countUsers(): Promise<number> {
  return UserModel.countDocuments();
}

export async function createUser(input: {
  name: string;
  roleId: string;
  pinHash: string;
}): Promise<TedographyUser> {
  const id = randomUUID();
  const doc = await UserModel.create({ id, ...input });
  return toPublicUser(doc.toObject() as UserDoc);
}

/** Update the stored PIN hash for a user. Returns true if the user was found and updated. */
export async function updateUserPin(userId: string, pinHash: string): Promise<boolean> {
  const result = await UserModel.updateOne({ id: userId }, { $set: { pinHash } });
  return result.matchedCount > 0;
}
