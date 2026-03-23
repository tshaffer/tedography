import type { Person } from '@tedography/domain';
import mongoose, { type Model, Schema } from 'mongoose';

const personSchema = new Schema<Person>(
  {
    id: { type: String, required: true, unique: true, index: true, trim: true },
    displayName: { type: String, required: true, trim: true },
    sortName: { type: String, required: false, trim: true, default: null },
    aliases: { type: [String], required: true, default: [] },
    notes: { type: String, required: false, trim: true, default: null },
    isHidden: { type: Boolean, required: true, default: false },
    isArchived: { type: Boolean, required: true, default: false }
  },
  {
    collection: 'people',
    versionKey: false,
    timestamps: true,
    strict: true,
    minimize: false
  }
);

personSchema.index({ displayName: 1 });

export const PersonModel: Model<Person> =
  (mongoose.models.Person as Model<Person> | undefined) ??
  mongoose.model<Person>('Person', personSchema);
