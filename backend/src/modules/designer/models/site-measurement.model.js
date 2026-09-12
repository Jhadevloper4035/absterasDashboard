import mongoose from 'mongoose';

const attachmentSchema = new mongoose.Schema({
  key: { type: String, required: true },
  contentType: String,
  originalName: String,
  size: Number,
  checksum: String,
}, { _id: false });

const siteMeasurementSchema = new mongoose.Schema({
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  clientSite: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  title: { type: String, required: true, trim: true, maxlength: 160 },
  description: { type: String, trim: true, maxlength: 2000 },
  attachment: { type: attachmentSchema, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

siteMeasurementSchema.index({ client: 1, clientSite: 1, createdAt: -1 });
siteMeasurementSchema.index({ createdBy: 1, createdAt: -1 });

export const SiteMeasurement = mongoose.models.SiteMeasurement || mongoose.model('SiteMeasurement', siteMeasurementSchema);
