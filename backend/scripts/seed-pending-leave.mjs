import mongoose from 'mongoose';
import { connectDatabase } from '../src/config/db.js';
import { Employee } from '../src/models/employee.model.js';
import { LeaveRequest } from '../src/models/leave-request.model.js';
import { LeaveType } from '../src/models/leave-type.model.js';

try {
  await connectDatabase();
  const [employee, leaveType] = await Promise.all([
    Employee.findOne({ status: 'active' }),
    LeaveType.findOne({ name: 'Unpaid Leave' }),
  ]);
  if (!employee || !leaveType) throw new Error('An active employee and Unpaid Leave type are required');
  const date = new Date(); date.setUTCMonth(date.getUTCMonth() + 1, 3); date.setUTCHours(0, 0, 0, 0);
  await LeaveRequest.findOneAndUpdate(
    { employee: employee._id, reason: 'Demo pending HR approval' },
    { $set: { employee: employee._id, leaveType: leaveType._id, fromDate: date, toDate: date, days: 1, reason: 'Demo pending HR approval', status: 'pending', paidDays: 0 }, $unset: { approvedBy: 1, decisionNote: 1 } },
    { upsert: true, new: true, runValidators: true },
  );
  console.log('Pending leave approval demo request is ready.');
} finally {
  await mongoose.disconnect();
}
