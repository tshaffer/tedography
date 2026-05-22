import bcrypt from 'bcrypt';
import type { TedographyUser } from '@tedography/domain';
import { findUserDocById } from '../repositories/userRepository.js';

const SALT_ROUNDS = 10;

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, SALT_ROUNDS);
}

/**
 * Verify a PIN against the stored hash for a user.
 * Returns the public user record on success, or null on failure.
 */
export async function verifyPin(userId: string, pin: string): Promise<TedographyUser | null> {
  const doc = await findUserDocById(userId);
  if (!doc) {
    return null;
  }

  const match = await bcrypt.compare(pin, doc.pinHash);
  if (!match) {
    return null;
  }

  const rawCreatedAt = (doc as { createdAt?: unknown }).createdAt;
  const createdAt =
    rawCreatedAt instanceof Date
      ? rawCreatedAt.toISOString()
      : typeof rawCreatedAt === 'string'
      ? rawCreatedAt
      : new Date().toISOString();

  return { id: doc.id, name: doc.name, roleId: doc.roleId, createdAt };
}
