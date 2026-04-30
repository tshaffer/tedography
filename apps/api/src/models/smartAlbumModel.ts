import { PhotoState, type SmartAlbum, type SmartAlbumFilterSpec } from '@tedography/domain';
import mongoose, { type Model, Schema } from 'mongoose';

const smartAlbumFilterSpecSchema = new Schema<SmartAlbumFilterSpec>(
  {
    keywordId: { type: String, default: null, trim: true },
    photoState: { type: String, enum: Object.values(PhotoState), default: null },
    yearGroupId: { type: String, default: null, trim: true },
    peopleIds: { type: [String], default: null },
    peopleMatchMode: { type: String, enum: ['Any', 'All'], default: null },
    excludedPeopleIds: { type: [String], default: null },
    hasNoPeople: { type: Boolean, default: null },
    captureDateFrom: { type: String, default: null, trim: true },
    captureDateTo: { type: String, default: null, trim: true },
    captureDateAvailability: { type: String, enum: ['datedOnly', 'datedOrUndated', 'undatedOnly'], default: null }
  },
  {
    _id: false,
    id: false,
    strict: true,
    minimize: false
  }
);

const smartAlbumSchema = new Schema<SmartAlbum>(
  {
    id: { type: String, required: true, unique: true, index: true, trim: true },
    label: { type: String, required: true, trim: true },
    filterSpec: { type: smartAlbumFilterSpecSchema, required: true },
    createdAt: { type: String, required: true, trim: true },
    updatedAt: { type: String, required: true, trim: true }
  },
  {
    collection: 'smartAlbums',
    versionKey: false,
    strict: true,
    minimize: false
  }
);

smartAlbumSchema.index({ label: 1, id: 1 });

export const SmartAlbumModel: Model<SmartAlbum> =
  (mongoose.models.SmartAlbum as Model<SmartAlbum> | undefined) ??
  mongoose.model<SmartAlbum>('SmartAlbum', smartAlbumSchema);
