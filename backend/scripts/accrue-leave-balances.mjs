import mongoose from 'mongoose';
import { connectDatabase } from '../src/config/db.js';
import { Employee } from '../src/models/employee.model.js';
import { LeaveBalance } from '../src/models/leave-balance.model.js';
import { LeaveType } from '../src/models/leave-type.model.js';

const now = new Date();
const year = now.getUTCFullYear();
const month = now.toISOString().slice(0, 7);

try {
  await connectDatabase();
  const [employees, leaveTypes] = await Promise.all([Employee.find({ status: 'active' }).select('_id'), LeaveType.find({ accrualPerMonth: { $gt: 0 } })]);
  let credited = 0;
  for (const employee of employees) for (const leaveType of leaveTypes) {
    const balance = await LeaveBalance.findOneAndUpdate({ employee: employee._id, leaveType: leaveType._id, year }, { $setOnInsert: { employee: employee._id, leaveType: leaveType._id, year, balance: 0 } }, { upsert: true, new: true });
    // ponytail: only the current month is accrued; add catch-up policy if delayed runs must backfill.
    if (balance.lastAccruedMonth === month) continue;
    balance.balance = Math.min(leaveType.maxBalance, balance.balance + leaveType.accrualPerMonth);
    balance.lastAccruedMonth = month;
    await balance.save();
    credited += 1;
  }
  console.log(`Leave accrual complete: ${credited} balances credited for ${month}.`);
} finally {
  await mongoose.disconnect();
}
