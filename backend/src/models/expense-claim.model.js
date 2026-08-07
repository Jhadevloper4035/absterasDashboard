import mongoose from 'mongoose';

const receiptSchema = new mongoose.Schema({ key: { type: String, required: true }, contentType: { type: String, required: true }, originalName: String, size: Number, checksum: String }, { _id: false });
const expenseClaimSchema = new mongoose.Schema({ employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true }, category: { type: String, required: true, trim: true }, amount: { type: Number, min: 0.01, required: true }, note: { type: String, required: true, trim: true }, receipts: { type: [receiptSchema], validate: { validator: (items) => items.length > 0, message: 'At least one payment screenshot is required' } }, status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' }, approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, decisionNote: { type: String, trim: true }, reimbursedInPayroll: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollRun', default: null } }, { timestamps: true });
expenseClaimSchema.index({ employee: 1, status: 1, createdAt: -1 });

export const ExpenseClaim = mongoose.models.ExpenseClaim || mongoose.model('ExpenseClaim', expenseClaimSchema);
