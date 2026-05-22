/**
 * Seed (or update) the three default roles in the database.
 *
 * Safe to run multiple times — uses upsert so existing roles are updated
 * rather than duplicated. Run this whenever the permission table changes.
 *
 * Usage (from apps/api/):
 *   tsx src/tools/seedRoles.ts
 */

import mongoose from 'mongoose';
import type { PermissionMap, TedographyRole } from '@tedography/domain';
import { connectToMongo } from '../db.js';
import { upsertRole } from '../repositories/roleRepository.js';
import { log } from '../logger.js';

const admin: PermissionMap = {
  'import':               'allow',
  'rotate-and-crop':      'allow',
  'set-photo-state':      'allow',
  'create-albums':        'allow',
  'move-photos-to-album': 'allow',
  'remove-from-album':    'allow',
  'keyword-management':   'allow',
  'people-face-review':   'allow',
  'print':                'allow',
  'maintenance':          'allow',
};

const full: PermissionMap = {
  'import':               'allow',
  'rotate-and-crop':      'allow',
  'set-photo-state':      'allow',
  'create-albums':        'allow',
  'move-photos-to-album': 'allow',
  'remove-from-album':    'allow',
  'keyword-management':   'allow',
  'people-face-review':   'allow',
  'print':                'allow',
  'maintenance':          'deny',
};

const limited: PermissionMap = {
  'import':               'deny',
  'rotate-and-crop':      'per-album',
  'set-photo-state':      'per-album',
  'create-albums':        'allow',
  'move-photos-to-album': 'per-album',
  'remove-from-album':    'per-album',
  'keyword-management':   'deny',
  'people-face-review':   'per-album',
  'print':                'per-album',
  'maintenance':          'deny',
};

const roles: TedographyRole[] = [
  { id: 'admin',   displayName: 'Admin',   permissions: admin },
  { id: 'full',    displayName: 'Full',    permissions: full },
  { id: 'limited', displayName: 'Limited', permissions: limited },
];

await connectToMongo();

for (const role of roles) {
  await upsertRole(role);
  log.info(`Upserted role: ${role.id}`);
  console.log(`  ✓ ${role.id} (${role.displayName})`);
}

console.log('\nDone — roles seeded.');
await mongoose.disconnect();
