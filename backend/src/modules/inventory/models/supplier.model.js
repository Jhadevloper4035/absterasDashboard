import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true }, contactPerson: { type: String, trim: true }, phone: { type: String, trim: true }, email: { type: String, trim: true, lowercase: true },
  address: { type: String, trim: true }, taxId: { type: String, trim: true }, notes: { type: String, trim: true }, serviceTypes: { type: [{ type: String, enum: ['laser_cut', 'powder_coating'] }], default: [] }, status: { type: String, enum: ['active', 'inactive'], default: 'active' },
}, { timestamps: true });
schema.index({ name: 1, status: 1 });
export const Supplier = mongoose.models.Supplier || mongoose.model('Supplier', schema);
