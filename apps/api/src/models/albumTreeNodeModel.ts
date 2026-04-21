import { type AlbumTreeNode } from '@tedography/domain';
import mongoose, { type Model, Schema } from 'mongoose';

const albumTreeNodeSchema = new Schema<AlbumTreeNode>(
  {
    id: { type: String, required: true, unique: true, index: true, trim: true },
    label: { type: String, required: true, trim: true },
    nodeType: { type: String, required: true, enum: ['Group', 'Album'] },
    parentId: { type: String, required: false, default: null, trim: true },
    sortOrder: { type: Number, required: true },
    childOrderMode: {
      type: String,
      required: false,
      enum: ['Custom', 'Name', 'NumericThenName'],
      default: null
    },
    createdAt: { type: String, required: true, trim: true },
    updatedAt: { type: String, required: true, trim: true }
  },
  {
    collection: 'albumTreeNodes',
    versionKey: false,
    strict: true,
    minimize: false
  }
);

albumTreeNodeSchema.index({ parentId: 1, sortOrder: 1 });

export const AlbumTreeNodeModel: Model<AlbumTreeNode> =
  (mongoose.models.AlbumTreeNode as Model<AlbumTreeNode> | undefined) ??
  mongoose.model<AlbumTreeNode>('AlbumTreeNode', albumTreeNodeSchema);
