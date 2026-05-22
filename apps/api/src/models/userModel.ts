import mongoose, { type Model, Schema } from 'mongoose';

/** Internal document shape — includes pinHash which is never sent to clients */
export interface UserDoc {
  id: string;
  name: string;
  roleId: string;
  pinHash: string;
  createdAt?: string;
  updatedAt?: string;
}

const userSchema = new Schema<UserDoc>(
  {
    id:      { type: String, required: true, unique: true, index: true, trim: true },
    name:    { type: String, required: true, trim: true },
    roleId:  { type: String, required: true, trim: true },
    pinHash: { type: String, required: true },
  },
  {
    collection: 'users',
    versionKey: false,
    timestamps: true,
    strict: true,
    minimize: false,
  }
);

userSchema.index({ name: 1 });

export const UserModel: Model<UserDoc> =
  (mongoose.models.User as Model<UserDoc> | undefined) ??
  mongoose.model<UserDoc>('User', userSchema);
