import { StorageRole } from '../enums/StorageRole.js';

export interface StorageInstance {
  id: string;
  assetId: string;
  role: StorageRole;
  path: string;
  verifiedAt?: string;
}
