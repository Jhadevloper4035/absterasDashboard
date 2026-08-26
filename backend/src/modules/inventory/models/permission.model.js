import mongoose from 'mongoose';

export const INVENTORY_MODULES = ['categories', 'items', 'transactions', 'reports'];
export const INVENTORY_ACCESS_LEVELS = ['none', 'view', 'manage'];

const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  module: { type: String, enum: INVENTORY_MODULES, required: true },
  access: { type: String, enum: INVENTORY_ACCESS_LEVELS, default: 'none' },
  grantedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });
schema.index({ user: 1, module: 1 }, { unique: true });
export const InventoryPermission = mongoose.models.InventoryPermission || mongoose.model('InventoryPermission', schema);
