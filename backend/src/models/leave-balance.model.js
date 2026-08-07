import mongoose from 'mongoose';

const leaveBalanceSchema = new mongoose.Schema({ employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true }, leaveType: { type: mongoose.Schema.Types.ObjectId, ref: 'LeaveType', required: true }, year: { type: Number, required: true }, balance: { type: Number, min: 0, default: 0 }, lastAccruedMonth: String }, { timestamps: true });
leaveBalanceSchema.index({ employee: 1, leaveType: 1, year: 1 }, { unique: true });

export const LeaveBalance = mongoose.models.LeaveBalance || mongoose.model('LeaveBalance', leaveBalanceSchema);
