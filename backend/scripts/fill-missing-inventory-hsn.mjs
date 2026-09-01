import mongoose from 'mongoose';
import { connectDatabase } from '../src/config/db.js';
import { DEFAULT_HSN_CODE, InventoryItem } from '../src/modules/inventory/models/item.model.js';

try {
  await connectDatabase();
  const result = await InventoryItem.updateMany({ $or: [{ hsnCode: { $exists: false } }, { hsnCode: null }, { hsnCode: '' }] }, { $set: { hsnCode: DEFAULT_HSN_CODE } });
  console.log(`Updated ${result.modifiedCount} inventory products with HSN ${DEFAULT_HSN_CODE}`);
} finally {
  await mongoose.disconnect();
}
