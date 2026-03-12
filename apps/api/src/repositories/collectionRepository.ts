import { type Collection } from '@tedography/domain';
import { randomUUID } from 'node:crypto';
import { CollectionModel } from '../models/collectionModel.js';

export async function syncCollectionIndexes(): Promise<void> {
  await CollectionModel.syncIndexes();
}

export async function listCollections(): Promise<Collection[]> {
  return CollectionModel.find({}, { _id: 0 }).sort({ name: 1 }).lean<Collection[]>();
}

export async function findCollectionById(id: string): Promise<Collection | null> {
  return CollectionModel.findOne({ id }, { _id: 0 }).lean<Collection | null>();
}

export async function createCollection(name: string): Promise<Collection> {
  const trimmedName = name.trim();
  const now = new Date().toISOString();
  const collection: Collection = {
    id: randomUUID(),
    name: trimmedName,
    createdAt: now,
    updatedAt: now
  };

  await CollectionModel.create(collection);
  return collection;
}

export async function renameCollection(collectionId: string, name: string): Promise<Collection | null> {
  return CollectionModel.findOneAndUpdate(
    { id: collectionId },
    {
      $set: {
        name: name.trim(),
        updatedAt: new Date().toISOString()
      }
    },
    { new: true, projection: { _id: 0 }, runValidators: true }
  ).lean<Collection | null>();
}

export async function deleteCollection(collectionId: string): Promise<boolean> {
  const result = await CollectionModel.deleteOne({ id: collectionId });
  return result.deletedCount > 0;
}
