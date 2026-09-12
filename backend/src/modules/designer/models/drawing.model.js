import mongoose from 'mongoose';

export const DRAWING_STATUSES = ['PENDING_REVIEW', 'REVISION_REQUESTED', 'APPROVED', 'REJECTED'];

const attachmentSchema = new mongoose.Schema({
  key: { type: String, required: true },
  contentType: String,
  originalName: String,
  size: Number,
  checksum: String,
}, { _id: false });

const versionSchema = new mongoose.Schema({
  number: { type: Number, required: true, min: 1 },
  attachment: { type: attachmentSchema, required: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: { createdAt: 'uploadedAt', updatedAt: false } });

const historySchema = new mongoose.Schema({
  action: { type: String, enum: ['SUBMITTED', 'REVISION_REQUESTED', 'APPROVED', 'REJECTED'], required: true },
  comment: { type: String, trim: true, maxlength: 1000 },
  attachment: attachmentSchema,
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: { createdAt: 'createdAt', updatedAt: false } });

const drawingSchema = new mongoose.Schema({
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  clientSite: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  title: { type: String, required: true, trim: true, maxlength: 160 },
  description: { type: String, trim: true, maxlength: 2000 },
  status: { type: String, enum: DRAWING_STATUSES, default: 'PENDING_REVIEW', required: true },
  versions: { type: [versionSchema], validate: [(versions) => versions.length > 0, 'A drawing file is required'] },
  history: { type: [historySchema], default: [] },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

drawingSchema.index({ client: 1, clientSite: 1 }, { unique: true });
drawingSchema.index({ status: 1, createdAt: -1 });
drawingSchema.index({ createdBy: 1, createdAt: -1 });

export const Drawing = mongoose.models.Drawing || mongoose.model('Drawing', drawingSchema);
