import mongoose from 'mongoose';

export const SEND_SAMPLE_CATEGORY = 'Send Sample';
export const SITE_EXPENSE_STATUSES = ['pending', 'done', 'canceled'];

const screenshotSchema = new mongoose.Schema({
  key: { type: String, required: true },
  contentType: { type: String, required: true },
  originalName: String,
  size: Number,
  checksum: String,
}, { _id: false });

const siteExpenseSchema = new mongoose.Schema({
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required() { return this.category !== SEND_SAMPLE_CATEGORY || Boolean(this.clientSite); } },
  clientSite: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required() { return this.category !== SEND_SAMPLE_CATEGORY || Boolean(this.client); } },
  category: { type: String, required: true, trim: true, maxlength: 80 },
  status: { type: String, enum: SITE_EXPENSE_STATUSES, default: 'pending' },
  title: { type: String, required: true, trim: true, maxlength: 160 },
  remark: { type: String, required: true, trim: true, maxlength: 2000 },
  amount: { type: Number, required: true, min: 0.01 },
  paymentScreenshot: {
    type: screenshotSchema,
    required: true,
    validate: { validator: (file) => ['image/jpeg', 'image/png', 'image/webp'].includes(file?.contentType), message: 'A payment screenshot image is required' },
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

siteExpenseSchema.index({ client: 1, clientSite: 1, createdAt: -1 });
siteExpenseSchema.index({ createdBy: 1, createdAt: -1 });

export const SiteExpense = mongoose.models.SiteExpense || mongoose.model('SiteExpense', siteExpenseSchema);
