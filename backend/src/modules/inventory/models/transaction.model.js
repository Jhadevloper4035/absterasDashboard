import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  item: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', required: true },
  type: { type: String, enum: ['in', 'out', 'adjustment'], required: true },
  quantity: { type: Number, required: true },
  reference: { type: String, trim: true },
  note: { type: String, trim: true },
  purchaseDate: { type: Date, default: Date.now },
  bill: { key: String, contentType: String, originalName: String, size: Number, checksum: String, attachmentToken: String },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });
schema.index({ item: 1, createdAt: -1 });
export const StockTransaction = mongoose.models.StockTransaction || mongoose.model('StockTransaction', schema);
