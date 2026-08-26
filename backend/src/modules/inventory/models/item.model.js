import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  sku: { type: String, required: true, unique: true, trim: true, uppercase: true },
  productCode: { type: String, trim: true, uppercase: true },
  category: { type: String, required: true, trim: true, lowercase: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  unit: { type: String, enum: ['pcs', 'nos', 'sheet', 'meter', 'running_meter', 'sq_ft', 'sq_m', 'kg', 'box', 'set', 'roll', 'bundle'], default: 'pcs' },
  quantityInStock: { type: Number, required: true, default: 0, min: 0 },
  minStockLevel: { type: Number, required: true, default: 0, min: 0 },
  location: { type: String, trim: true },
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
  unitCost: { type: Number, min: 0 },
  status: { type: String, enum: ['active', 'inactive', 'discontinued'], default: 'active' },
  productImage: { key: String, contentType: String, originalName: String, size: Number, checksum: String, attachmentToken: String },
  shadeImage: { key: String, contentType: String, originalName: String, size: Number, checksum: String, attachmentToken: String },
  specs: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });
schema.index({ category: 1, status: 1, createdAt: -1 });
schema.index({ name: 'text', sku: 'text' });
export const InventoryItem = mongoose.models.InventoryItem || mongoose.model('InventoryItem', schema);
