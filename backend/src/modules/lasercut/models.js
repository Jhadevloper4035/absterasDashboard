import mongoose from 'mongoose';

const db = mongoose.connection;
const { ObjectId, Mixed } = mongoose.Schema.Types;
const dimensions = new mongoose.Schema({ heightFt: { type: Number, min: 0 }, widthFt: { type: Number, min: 0 }, lengthFt: { type: Number, min: 0 } }, { _id: false });
const quantities = new mongoose.Schema({ sheets: { type: Number, min: 0, default: 0 }, tubes: { type: Number, min: 0, default: 0 } }, { _id: false });
const vendorSchema = new mongoose.Schema({ name: { type: String, required: true, trim: true }, contactPerson: { type: String, trim: true }, phone: { type: String, trim: true }, email: { type: String, trim: true, lowercase: true }, address: { type: String, trim: true }, notes: { type: String, trim: true }, status: { type: String, enum: ['active', 'inactive'], default: 'active' } }, { timestamps: true });
vendorSchema.index({ name: 1, status: 1 });

const orderSchema = new mongoose.Schema({
  orderName: { type: String, required: true, trim: true }, customerRef: { type: String, trim: true },
  expected: { type: quantities, default: () => ({}) }, sent: { type: quantities, default: () => ({}) },
  panelSpec: { count: { type: Number, min: 0 }, panelAreaSqFt: { type: Number, min: 0 } },
  status: { type: String, enum: ['PENDING', 'PARTIAL', 'COMPLETE'], default: 'PENDING' },
}, { timestamps: true });
orderSchema.index({ status: 1, createdAt: -1 });

const lineSchema = new mongoose.Schema({
  inventoryItemRef: { type: ObjectId, required: true }, itemName: { type: String, required: true },
  hsnCode: { type: String, trim: true }, unit: { type: String, trim: true },
  pickupSupplierRef: { type: ObjectId }, pickupSupplierName: { type: String, trim: true }, pickupAddressSnapshot: { type: String, trim: true },
  materialType: { type: String, enum: ['SHEET', 'TUBE', 'OTHER'], required: true }, quantity: { type: Number, required: true, min: 0.01 }, dimensions: dimensions,
}, { _id: false });
const challanSchema = new mongoose.Schema({
  challanNo: { type: String, required: true, unique: true }, type: { type: String, enum: ['OUT', 'IN'], required: true },
  challanDate: { type: Date, required: true, default: Date.now }, clientRef: { type: ObjectId }, clientName: { type: String, trim: true }, clientSiteRef: { type: ObjectId }, clientSiteName: { type: String, trim: true }, clientSiteAddressSnapshot: { type: String, trim: true }, deliveryAddress: { type: String, trim: true },
  vendorRef: { type: ObjectId, required: true }, vendorName: { type: String, required: true }, vendorAddressSnapshot: { type: String, trim: true },
  transportType: { type: String, trim: true }, vehicleNumber: { type: String, trim: true, uppercase: true }, eWayBillNumber: { type: String, trim: true },
  orderRef: { type: ObjectId }, items: { type: [lineSchema], validate: [(items) => items.length > 0, 'At least one item is required'] },
  status: { type: String, enum: ['DRAFT', 'DISPATCHED', 'RECEIVED'], default: 'DRAFT' }, dispatchedAt: Date, receivedAt: Date, createdBy: { type: ObjectId, required: true },
}, { timestamps: true });
challanSchema.index({ vendorRef: 1, createdAt: -1 }); challanSchema.index({ orderRef: 1, createdAt: -1 });

const stockSchema = new mongoose.Schema({
  vendorRef: { type: ObjectId, required: true }, vendorName: { type: String, required: true }, materialKey: { type: String, required: true }, inventoryItemRef: { type: ObjectId }, itemName: { type: String, trim: true }, hsnCode: { type: String, trim: true }, unit: { type: String, trim: true },
  materialType: { type: String, enum: ['SHEET', 'TUBE', 'OTHER'], required: true }, dimensions, quantityAvailable: { type: Number, required: true, min: 0, default: 0 },
}, { timestamps: true });
stockSchema.index({ vendorRef: 1, materialKey: 1 }, { unique: true });

const usageSchema = new mongoose.Schema({
  vendorRef: { type: ObjectId, required: true }, orderRef: { type: ObjectId, required: true }, materialType: { type: String, enum: ['SHEET', 'TUBE'], required: true },
  dimensions: { type: dimensions, required: true }, quantityConsumed: { type: Number, required: true, min: 0.01 }, panelsProduced: { type: Number, min: 0, default: 0 },
  wastageAreaSqFt: Number, wastagePercent: Number, reportedAt: { type: Date, default: Date.now }, createdBy: { type: ObjectId, required: true },
}, { timestamps: true });
usageSchema.index({ orderRef: 1, reportedAt: -1 });

const auditSchema = new mongoose.Schema({
  entityType: { type: String, required: true }, entityId: { type: String, required: true }, action: { type: String, required: true }, performedBy: { type: ObjectId, required: true },
  before: Mixed, after: Mixed, metadata: Mixed,
}, { timestamps: true });
auditSchema.index({ entityType: 1, entityId: 1, createdAt: -1 }); auditSchema.index({ performedBy: 1, createdAt: -1 });

export const LaserCutOrder = db.models.LaserCutOrder || db.model('LaserCutOrder', orderSchema);
export const LaserCutChallan = db.models.LaserCutChallan || db.model('LaserCutChallan', challanSchema);
export const LaserCutStock = db.models.LaserCutStock || db.model('LaserCutStock', stockSchema);
export const LaserCutUsage = db.models.LaserCutUsage || db.model('LaserCutUsage', usageSchema);
export const LaserCutAudit = db.models.LaserCutAudit || db.model('LaserCutAudit', auditSchema);
export const LaserCutVendor = db.models.LaserCutVendor || db.model('LaserCutVendor', vendorSchema);
