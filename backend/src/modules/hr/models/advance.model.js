import mongoose from 'mongoose';

const advanceSchema = new mongoose.Schema({ employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true }, amount: { type: Number, min: 0.01, required: true }, reason: { type: String, required: true, trim: true }, status: { type: String, enum: ['pending', 'approved', 'rejected', 'settled'], default: 'pending' }, deductionSchedule: { monthlyAmount: { type: Number, min: 0.01, required: true } }, deductedAmount: { type: Number, min: 0, default: 0 }, approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } }, { timestamps: true });
advanceSchema.index({ employee: 1, status: 1 });

export const Advance = mongoose.models.Advance || mongoose.model('Advance', advanceSchema);
