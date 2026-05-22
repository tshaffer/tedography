import type { TedographyRole } from '@tedography/domain';
import { log } from '../logger.js';
import { RoleModel } from '../models/roleModel.js';

export async function syncRoleIndexes(): Promise<void> {
  await RoleModel.syncIndexes();
  log.info('Synchronized role indexes');
}

export async function findRoleById(id: string): Promise<TedographyRole | null> {
  const doc = await RoleModel.findOne({ id }, { _id: 0 }).lean<TedographyRole | null>();
  return doc ?? null;
}

export async function listRoles(): Promise<TedographyRole[]> {
  return RoleModel.find({}, { _id: 0 }).sort({ id: 1 }).lean<TedographyRole[]>();
}

export async function upsertRole(role: TedographyRole): Promise<TedographyRole> {
  const doc = await RoleModel.findOneAndUpdate(
    { id: role.id },
    { $set: role },
    { upsert: true, new: true, lean: true, projection: { _id: 0 } }
  );
  return doc as TedographyRole;
}
