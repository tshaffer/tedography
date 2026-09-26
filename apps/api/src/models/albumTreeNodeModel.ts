import { locationDisplayModes, type AlbumTreeNode } from '@tedography/domain';
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
      enum: ['Custom', 'Name', 'NumericThenName', 'CaptureDate'],
      default: null
    },
    keywordAssignmentStatus: {
      type: String,
      required: false,
      enum: ['not-started', 'in-progress', 'complete'],
      default: null
    },
    reviewAssignmentStatus: {
      type: String,
      required: false,
      enum: ['not-started', 'in-progress', 'complete'],
      default: null
    },
    peopleAssignmentStatus: {
      type: String,
      required: false,
      enum: ['not-started', 'in-progress', 'complete'],
      default: null
    },
    writerUserIds: { type: [String], required: false, default: [] },
    defaultLocationLabel: { type: String, required: false, trim: true, default: null },
    defaultCity: { type: String, required: false, trim: true, default: null },
    defaultState: { type: String, required: false, trim: true, default: null },
    defaultCountry: { type: String, required: false, trim: true, default: null },
    defaultLocationLatitude: { type: Number, required: false, default: null },
    defaultLocationLongitude: { type: Number, required: false, default: null },
    defaultPlaceName: { type: String, required: false, trim: true, default: null },
    locationDisplayMode: {
      type: String,
      required: false,
      enum: [...locationDisplayModes, null],
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
