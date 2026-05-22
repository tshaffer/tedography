/**
 * Bootstrap script — create the first admin user.
 *
 * Usage:
 *   tsx src/tools/createAdminUser.ts "<name>" "<pin>"
 *
 * Example:
 *   tsx src/tools/createAdminUser.ts "Ted" "1234"
 *
 * The script aborts if a user with the same name already exists.
 * Run from apps/api/ so the .env file is picked up automatically.
 */

import mongoose from 'mongoose';
import { connectToMongo } from '../db.js';
import { hashPin } from '../auth/authService.js';
import { countUsers, createUser, listUsers } from '../repositories/userRepository.js';
import { log } from '../logger.js';

const [, , nameArg, pinArg] = process.argv;

if (!nameArg || !pinArg) {
  console.error('Usage: tsx src/tools/createAdminUser.ts "<name>" "<pin>"');
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
const roleId = total === 0 ? 'admin' : 'full';

const pinHash = await hashPin(pin);
const user = await createUser({ name, roleId, pinHash });

log.info(`Created user "${user.name}" (id: ${user.id}, role: ${user.roleId})`);
console.log(`\nDone.\n  Name: ${user.name}\n  ID:   ${user.id}\n  Role: ${user.roleId}\n`);

await mongoose.disconnect();
