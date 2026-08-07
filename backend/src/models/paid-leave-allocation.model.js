import mongoose from 'mongoose';

const paidLeaveAllocationSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  month: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
  request: { type: mongoose.Schema.Types.ObjectId, ref: 'LeaveRequest', required: true },
}, { timestamps: true });

paidLeaveAllocationSchema.index({ employee: 1, month: 1 }, { unique: true });

export const PaidLeaveAllocation = mongoose.models.PaidLeaveAllocation || mongoose.model('PaidLeaveAllocation', paidLeaveAllocationSchema);
