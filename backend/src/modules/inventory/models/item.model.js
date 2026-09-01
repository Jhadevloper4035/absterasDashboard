import mongoose from 'mongoose';

export const DEFAULT_HSN_CODE = '0000';

export function laserCutMaterialDetails(item) {
  const materialType = ['SHEET', 'TUBE', 'OTHER'].includes(item.materialType) ? item.materialType : 'OTHER';
  const dimensions = item.defaultDimensions || {};
  if (materialType !== 'SHEET' && !/\bsheet\b/i.test(item.name || '')) return { materialType, defaultDimensions: dimensions };

  const heightFt = Number(dimensions.heightFt);
  const widthFt = Number(dimensions.widthFt);
  if (heightFt > 0 && widthFt > 0) return { materialType: 'SHEET', defaultDimensions: { heightFt, widthFt } };

  const specs = item.specs || {};
  const heightFromSpecs = Number(specs.height);
  const widthFromSpecs = Number(specs.width);
  if (heightFromSpecs > 0 && widthFromSpecs > 0 && heightFromSpecs <= 100 && widthFromSpecs <= 100) return { materialType: 'SHEET', defaultDimensions: { heightFt: heightFromSpecs, widthFt: widthFromSpecs } };

  const lengthMm = Number(specs.length);
  const widthMm = Number(specs.width);
  if (lengthMm > 100 && widthMm > 100) return { materialType: 'SHEET', defaultDimensions: { heightFt: lengthMm / 304.8, widthFt: widthMm / 304.8 } };

  const match = String(item.name || '').match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i);
  const firstMm = Number(match?.[1]);
  const secondMm = Number(match?.[2]);
  return firstMm > 100 && secondMm > 100
    ? { materialType: 'SHEET', defaultDimensions: { heightFt: firstMm / 304.8, widthFt: secondMm / 304.8 } }
    : { materialType, defaultDimensions: dimensions };
}

const schema = new mongoose.Schema({
  sku: { type: String, required: true, unique: true, trim: true, uppercase: true },
  productCode: { type: String, trim: true, uppercase: true },
  category: { type: String, required: true, trim: true, lowercase: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  hsnCode: { type: String, trim: true, required: true, default: DEFAULT_HSN_CODE },
  unit: { type: String, enum: ['pcs', 'nos', 'sheet', 'ft', 'meter', 'running_meter', 'sq_ft', 'sq_m', 'kg', 'box', 'set', 'roll', 'bundle'], default: 'pcs' },
  materialType: { type: String, enum: ['SHEET', 'TUBE', 'OTHER'], default: 'OTHER' },
  defaultDimensions: {
    heightFt: { type: Number, min: 0 },
    widthFt: { type: Number, min: 0 },
    lengthFt: { type: Number, min: 0 },
  },
  quantityInStock: { type: Number, required: true, default: 0, min: 0 },
  minStockLevel: { type: Number, required: true, default: 0, min: 0 },
  location: { type: String, trim: true },
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
  shadeName: { type: String, trim: true },
  shadeCode: { type: String, trim: true, uppercase: true },
  unitCost: { type: Number, min: 0 },
  status: { type: String, enum: ['active', 'inactive', 'discontinued'], default: 'active' },
  productImage: { key: String, contentType: String, originalName: String, size: Number, checksum: String, attachmentToken: String },
  shadeImage: { key: String, contentType: String, originalName: String, size: Number, checksum: String, attachmentToken: String },
  specs: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });
schema.index({ category: 1, status: 1, createdAt: -1 });
schema.index({ name: 'text', sku: 'text' });
export const InventoryItem = mongoose.models.InventoryItem || mongoose.model('InventoryItem', schema);
