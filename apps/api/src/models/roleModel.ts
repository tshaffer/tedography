import mongoose, { type Model, Schema } from 'mongoose';
import type { TedographyRole } from '@tedography/domain';

const roleSchema = new Schema<TedographyRole>(
  {
    id:          { type: String, required: true, unique: true, index: true, trim: true },
    displayName: { type: String, required: true, trim: true },
    permissions: { type: Schema.Types.Mixed, required: true },
  },
  {
    collection: 'roles',
    versionKey: false,
    timestamps: true,
    strict: true,
    minimize: false,
  }
);

export const RoleModel: Model<TedographyRole> =
  (mongoose.models.Role as Model<TedographyRole> | undefined) ??
  mongoose.model<TedographyRole>('Role', roleSchema);
