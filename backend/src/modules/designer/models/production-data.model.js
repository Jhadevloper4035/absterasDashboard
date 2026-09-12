import mongoose from 'mongoose';

const attachmentSchema = new mongoose.Schema({
  key: { type: String, required: true },
  contentType: String,
  originalName: String,
  size: Number,
  checksum: String,
}, { _id: false });

const productionDataSchema = new mongoose.Schema({
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  clientSite: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  title: { type: String, required: true, trim: true, maxlength: 160 },
  description: { type: String, trim: true, maxlength: 2000 },
  sourceDocuments: {
    boq: { type: attachmentSchema, required: true },
    drawing: { type: attachmentSchema, required: true },
    siteMeasurement: { type: attachmentSchema, required: true },
  },
  attachment: attachmentSchema,
  attachments: { type: [attachmentSchema], validate: [(attachments) => !attachments || attachments.length > 0, 'At least one production data file is required'] },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

productionDataSchema.index({ client: 1, clientSite: 1 }, { unique: true });
productionDataSchema.index({ createdBy: 1, createdAt: -1 });

export const ProductionData = mongoose.models.ProductionData || mongoose.model('ProductionData', productionDataSchema);
