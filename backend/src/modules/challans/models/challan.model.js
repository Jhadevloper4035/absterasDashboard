import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;
const lineItemSchema = new mongoose.Schema({ inventoryItem: { type: ObjectId, ref: 'InventoryItem' }, description: { type: String, required: true, trim: true }, hsnCode: { type: String, trim: true }, quantity: { type: Number, required: true, min: 0 }, unit: { type: String, trim: true } }, { _id: false });
const returnProductLineSchema = new mongoose.Schema({ product: { type: ObjectId, ref: 'ReturnProduct', required: true }, quantity: { type: Number, required: true, min: 0 } }, { _id: false });

const challanSchema = new mongoose.Schema({
  challanNumber: { type: String, required: true, trim: true, unique: true },
  client: { type: ObjectId, ref: 'Client', required: true },
  supplier: { type: ObjectId, ref: 'Supplier' },
  sourceSite: { type: ObjectId, ref: 'Client' },
  site: { type: ObjectId, ref: 'Client' },
  returnRecord: { type: ObjectId, ref: 'ReturnRecord' },
  returnProducts: { type: [returnProductLineSchema], default: [] },
  transferType: { type: String, enum: ['delivery', 'return_transfer'], default: 'delivery' },
  challanDate: { type: Date, required: true },
  pickupAddress: { type: String, trim: true },
  transportType: { type: String, trim: true },
  vehicleNumber: { type: String, trim: true, uppercase: true },
  eWayBillNumber: { type: String, trim: true },
  lineItems: { type: [lineItemSchema], default: [] },
  linkedInvoice: { type: ObjectId, ref: 'Invoice' },
  pdfFileUrl: { type: String, trim: true },
}, { timestamps: true });

challanSchema.index({ client: 1, challanDate: -1 });
challanSchema.index({ site: 1, challanDate: -1 });
challanSchema.index({ sourceSite: 1, challanDate: -1 });
export const Challan = mongoose.models.Challan || mongoose.model('Challan', challanSchema);
