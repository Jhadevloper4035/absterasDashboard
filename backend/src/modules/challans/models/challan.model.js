import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;
const lineItemSchema = new mongoose.Schema({ item: { type: ObjectId, ref: 'Item' }, description: { type: String, required: true, trim: true }, hsnCode: { type: String, trim: true }, quantity: { type: Number, required: true, min: 0 }, unit: { type: String, trim: true }, rate: { type: Number, min: 0, default: 0 }, amount: { type: Number, required: true, min: 0 } }, { _id: false });

const challanSchema = new mongoose.Schema({
  challanNumber: { type: String, required: true, trim: true, unique: true },
  client: { type: ObjectId, ref: 'Client', required: true },
  challanDate: { type: Date, required: true },
  transportType: { type: String, trim: true },
  vehicleNumber: { type: String, trim: true, uppercase: true },
  eWayBillNumber: { type: String, trim: true },
  lineItems: { type: [lineItemSchema], default: [] },
  freightCharge: { type: Number, min: 0, default: 0 },
  taxableAmount: { type: Number, required: true, min: 0 },
  gstAmount: { type: Number, min: 0, default: 0 },
  roundOff: { type: Number, default: 0 },
  totalAmount: { type: Number, required: true, min: 0 },
  linkedInvoice: { type: ObjectId, ref: 'Invoice' },
  pdfFileUrl: { type: String, trim: true },
}, { timestamps: true });

challanSchema.index({ client: 1, challanDate: -1 });
export const Challan = mongoose.models.Challan || mongoose.model('Challan', challanSchema);
