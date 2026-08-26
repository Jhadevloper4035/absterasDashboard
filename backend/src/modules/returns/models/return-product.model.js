import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

const returnProductSchema = new mongoose.Schema({
  returnRecord: { type: ObjectId, ref: 'ReturnRecord', required: true },
  client: { type: ObjectId, ref: 'Client', required: true },
  sourceSite: { type: ObjectId, ref: 'Client', required: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  quantity: { type: Number, required: true, min: 0 },
  unit: { type: String, required: true, trim: true },
  storageLocation: { type: String, trim: true },
  status: { type: String, enum: ['stored', 'transferred'], required: true },
  createdBy: { type: ObjectId, ref: 'User', required: true },
}, { timestamps: true });

returnProductSchema.index({ client: 1, createdAt: -1 });
returnProductSchema.index({ sourceSite: 1, createdAt: -1 });

export const ReturnProduct = mongoose.models.ReturnProduct || mongoose.model('ReturnProduct', returnProductSchema);
