import mongoose from 'mongoose';

const siteExpenseCategorySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80, unique: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

export const SiteExpenseCategory = mongoose.models.SiteExpenseCategory || mongoose.model('SiteExpenseCategory', siteExpenseCategorySchema);
