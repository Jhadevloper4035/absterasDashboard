import mongoose from 'mongoose';
const schema = new mongoose.Schema({ name: { type: String, required: true, trim: true, unique: true }, isPaid: { type: Boolean, default: false }, accrualPerMonth: { type: Number, min: 0, default: 0 }, maxBalance: { type: Number, min: 0, required: true } }, { timestamps: true });
export const LeaveType = mongoose.models.LeaveType || mongoose.model('LeaveType', schema);
