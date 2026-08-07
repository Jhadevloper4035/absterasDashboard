import mongoose from 'mongoose';

const entrySchema = new mongoose.Schema({ employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true }, payableDays: Number, workingDays: Number, grossPay: Number, deductions: Number, netPay: Number, bonus: { type: Number, default: 0 }, advanceDeducted: { type: Number, default: 0 }, unpaidDeduction: { type: Number, default: 0 }, encashmentPay: { type: Number, default: 0 }, reimbursementPay: { type: Number, default: 0 } }, { _id: false });
const payrollRunSchema = new mongoose.Schema({ month: { type: Number, min: 1, max: 12, required: true }, year: { type: Number, min: 2000, required: true }, status: { type: String, enum: ['draft', 'processed'], default: 'draft' }, entries: [entrySchema], processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, processedAt: Date }, { timestamps: true });
payrollRunSchema.index({ month: 1, year: 1 }, { unique: true });

export const PayrollRun = mongoose.models.PayrollRun || mongoose.model('PayrollRun', payrollRunSchema);
