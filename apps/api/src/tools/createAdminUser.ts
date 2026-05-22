/**
 * Bootstrap script — create a user.
 *
 * Usage:
 *   tsx src/tools/createAdminUser.ts "<name>" "<pin>" [--role admin|full|limited]
 *
 * Examples:
 *   tsx src/tools/createAdminUser.ts "Ted" "1234"
 *   tsx src/tools/createAdminUser.ts "Lisa" "5678" --role limited
 *
 * If --role is omitted:
 *   - First user ever created → admin
 *   - Subsequent users        → full
 *
 * The script aborts if a user with the same name already exists.
 * Run from apps/api/ so the .env file is picked up automatically.
 */

import mongoose from 'mongoose';
import { connectToMongo } from '../db.js';
import { hashPin } from '../auth/authService.js';
import { countUsers, createUser, listUsers } from '../repositories/userRepository.js';
import { log } from '../logger.js';

const VALID_ROLES = ['admin', 'full', 'limited'] as const;
type ValidRole = (typeof VALID_ROLES)[number];

const args = process.argv.slice(2);
const nameArg = args[0];
const pinArg  = args[1];

// Parse optional --role flag
let explicitRole: ValidRole | null = null;
const roleIdx = args.indexOf('--role');
if (roleIdx !== -1) {
  const roleVal = args[roleIdx + 1];
  if (!roleVal || !(VALID_ROLES as readonly string[]).includes(roleVal)) {
    console.error(`--role must be one of: ${VALID_ROLES.join(', ')}`);
    process.exit(1);
  }
  explicitRole = roleVal as ValidRole;
}

if (!nameArg || !pinArg) {
  console.error('Usage: tsx src/tools/createAdminUser.ts "<name>" "<pin>" [--role admin|full|limited]');
  process.exit(1);
}

const name = nameArg.trim();
const pin  = pinArg.trim();

if (name.length === 0) {
  console.error('Name must not be empty.');
  process.exit(1);
}

if (pin.length < 4) {
  console.error('PIN must be at least 4 characters.');
  process.exit(1);
}

await connectToMongo();

const existing = await listUsers();
const conflict = existing.find((u) => u.name.toLowerCase() === name.toLowerCase());
if (conflict) {
  console.error(`A user named "${conflict.name}" already exists (id: ${conflict.id}).`);
  await mongoose.disconnect();
  process.exit(1);
}

const total = await countUsers();
const roleId: string = explicitRole ?? (total === 0 ? 'admin' : 'full');

const pinHash = await hashPin(pin);
const user = await createUser({ name, roleId, pinHash });

log.info(`Created user "${user.name}" (id: ${user.id}, role: ${user.roleId})`);
console.log(`\nDone.\n  Name: ${user.name}\n  ID:   ${user.id}\n  Role: ${user.roleId}\n`);

await mongoose.disconnect();
