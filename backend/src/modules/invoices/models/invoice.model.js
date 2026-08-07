import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

const invoiceLineItemSchema = new mongoose.Schema(
  {
    item: { type: ObjectId, ref: 'Item' },
    description: { type: String, required: true, trim: true },
    hsnCode: { type: String, trim: true },
    quantity: { type: Number, required: true, min: 0 },
    unit: { type: String, trim: true },
    unitPrice: { type: Number, required: true, min: 0 },
    lineAmount: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, trim: true },
    financialYear: { type: String, required: true, trim: true, match: /^\d{4}-\d{2}$/ },
    client: { type: ObjectId, ref: 'Client', required: true },
    invoiceDate: { type: Date, required: true },
    grRrNumber: { type: String, trim: true },
    transport: { type: String, trim: true },
    placeOfSupply: { type: String, trim: true },
    placeOfSupplyCode: { type: String, trim: true, match: /^\d{2}$/ },
    reverseCharge: { type: Boolean, default: false },
    vehicleNumber: { type: String, trim: true, uppercase: true },
    station: { type: String, trim: true },
    lineItems: { type: [invoiceLineItemSchema], default: [] },
    taxableAmount: { type: Number, required: true, min: 0 },
    igstAmount: { type: Number, min: 0, default: 0 },
    cgstAmount: { type: Number, min: 0, default: 0 },
    sgstAmount: { type: Number, min: 0, default: 0 },
    roundOff: { type: Number, default: 0 },
    grandTotal: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['unpaid', 'partially paid', 'paid'], default: 'unpaid' },
    pdfFileUrl: { type: String, trim: true },
  },
  { timestamps: true },
);

invoiceSchema.index({ financialYear: 1, invoiceNumber: 1 }, { unique: true });
invoiceSchema.index({ client: 1, invoiceDate: -1 });

export const Invoice = mongoose.models.Invoice || mongoose.model('Invoice', invoiceSchema);
