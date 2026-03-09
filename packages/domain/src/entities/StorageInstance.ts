import { StorageRole } from '../enums/StorageRole';

export interface StorageInstance {
  id: string;
  assetId: string;
  role: StorageRole;
  path: string;
  verifiedAt?: string;
}
