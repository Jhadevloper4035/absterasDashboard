import mongoose from 'mongoose';

const clientSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    gstin: { type: String, trim: true, uppercase: true },
    billingAddress: { type: String, trim: true },
    shippingAddress: { type: String, trim: true },
    state: { type: String, trim: true },
    stateCode: { type: String, trim: true, match: /^\d{2}$/ },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    siteName: { type: String, trim: true },
    siteAddress: { type: String, trim: true },
    startDate: Date,
    status: { type: String, enum: ['active', 'on hold', 'completed'], default: 'active' },
    estimatedValue: { type: Number, min: 0 },
    notes: { type: String, trim: true },
  },
  { timestamps: true },
);

clientSchema.index({ status: 1, createdAt: -1 });

export const Client = mongoose.models.Client || mongoose.model('Client', clientSchema);
