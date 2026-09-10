import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;
const attachment = new mongoose.Schema({ key: String, contentType: String, originalName: String, size: Number, checksum: String, attachmentToken: String }, { _id: false });
const vendor = new mongoose.Schema({ name: { type: String, required: true, trim: true }, contactPerson: { type: String, trim: true }, phone: { type: String, trim: true }, email: { type: String, trim: true, lowercase: true }, address: { type: String, trim: true }, notes: { type: String, trim: true }, status: { type: String, enum: ['active', 'inactive'], default: 'active' } }, { timestamps: true });
vendor.index({ name: 1, status: 1 });
const line = new mongoose.Schema({
  inventoryItemRef: { type: ObjectId, required: true }, itemName: { type: String, required: true, trim: true }, hsnCode: { type: String, trim: true }, unit: { type: String, trim: true }, dimensions: { heightFt: Number, widthFt: Number, lengthFt: Number }, quantity: { type: Number, required: true, min: 0.01 },
  shadeName: { type: String, required: true, trim: true }, shadeCode: { type: String, required: true, trim: true }, shadeImage: attachment,
  source: { type: String, enum: ['INVENTORY', 'LASER_CUT'], default: 'INVENTORY' }, laserCutStockRef: ObjectId,
  pickupSupplierRef: ObjectId, pickupSupplierName: { type: String, trim: true }, pickupAddressSnapshot: { type: String, trim: true },
}, { _id: false });
const coatingBatchItem = new mongoose.Schema({ inventoryItemRef: { type: ObjectId, required: true }, laserCutStockRef: ObjectId, quantity: { type: Number, required: true, min: 0.01 } }, { _id: false });
const coatingBatch = new mongoose.Schema({ batchNo: { type: String, required: true, trim: true }, items: { type: [coatingBatchItem], validate: [(items) => items.length > 0, 'At least one ready item is required'] }, recordedAt: { type: Date, default: Date.now }, createdBy: { type: ObjectId, required: true } }, { _id: false });

const order = new mongoose.Schema({
  orderNo: { type: String, required: true, unique: true }, clientRef: ObjectId, clientName: { type: String, trim: true }, clientSiteRef: ObjectId, clientSiteName: { type: String, trim: true }, clientSiteAddressSnapshot: { type: String, trim: true },
  laserCutOrderRef: ObjectId, laserCutOrderName: { type: String, trim: true },
  vendorRef: { type: ObjectId, required: true }, vendorName: { type: String, required: true, trim: true }, vendorAddressSnapshot: { type: String, trim: true },
  items: { type: [line], validate: [(items) => items.length > 0, 'At least one product is required'] }, coatingBatches: { type: [coatingBatch], default: [] }, status: { type: String, enum: ['OUT', 'RETURNED'], default: 'OUT' }, outwardChallanRef: ObjectId, inwardChallanRef: ObjectId, createdBy: { type: ObjectId, required: true },
}, { timestamps: true });
order.index({ status: 1, createdAt: -1 });

const challan = new mongoose.Schema({
  challanNo: { type: String, required: true, unique: true }, type: { type: String, enum: ['OUT', 'IN', 'SITE_OUT'], required: true }, challanDate: { type: Date, default: Date.now }, orderRef: { type: ObjectId, required: true },
  clientRef: ObjectId, clientName: { type: String, trim: true }, clientSiteRef: ObjectId, clientSiteName: { type: String, trim: true }, clientSiteAddressSnapshot: { type: String, trim: true },
  vendorRef: { type: ObjectId, required: true }, vendorName: { type: String, required: true, trim: true }, vendorAddressSnapshot: { type: String, trim: true }, transportType: { type: String, trim: true }, vehicleNumber: { type: String, trim: true, uppercase: true }, eWayBillNumber: { type: String, trim: true },
  items: { type: [line], validate: [(items) => items.length > 0, 'At least one product is required'] }, createdBy: { type: ObjectId, required: true },
}, { timestamps: true });
challan.index({ orderRef: 1, createdAt: -1 });

export const PowderCoatOrder = mongoose.models.PowderCoatOrder || mongoose.model('PowderCoatOrder', order);
export const PowderCoatChallan = mongoose.models.PowderCoatChallan || mongoose.model('PowderCoatChallan', challan);
export const PowderCoatVendor = mongoose.models.PowderCoatVendor || mongoose.model('PowderCoatVendor', vendor);
