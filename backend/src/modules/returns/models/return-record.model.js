import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

const returnItemSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  quantity: { type: Number, required: true, min: 0 },
  unit: { type: String, required: true, trim: true },
}, { _id: false });

const returnRecordSchema = new mongoose.Schema({
  returnNumber: { type: String, required: true, trim: true, unique: true },
  client: { type: ObjectId, ref: 'Client', required: true },
  sourceSite: { type: ObjectId, ref: 'Client', required: true },
  destinationSite: { type: ObjectId, ref: 'Client' },
  pickupDate: { type: Date, required: true },
  disposition: { type: String, enum: ['return_stock', 'site_transfer'], required: true },
  storageLocation: { type: String, trim: true },
  items: { type: [returnItemSchema], validate: [(items) => items.length > 0, 'At least one returned material is required'] },
  products: [{ type: ObjectId, ref: 'ReturnProduct' }],
  challan: { type: ObjectId, ref: 'Challan' },
  notes: { type: String, trim: true },
  createdBy: { type: ObjectId, ref: 'User', required: true },
}, { timestamps: true });

returnRecordSchema.index({ client: 1, pickupDate: -1 });
returnRecordSchema.index({ sourceSite: 1, pickupDate: -1 });

export const ReturnRecord = mongoose.models.ReturnRecord || mongoose.model('ReturnRecord', returnRecordSchema);
