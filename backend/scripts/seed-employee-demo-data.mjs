import mongoose from 'mongoose';
import { connectDatabase } from '../src/config/db.js';
import { Advance } from '../src/models/advance.model.js';
import { Attendance } from '../src/models/attendance.model.js';
import { Employee } from '../src/models/employee.model.js';
import { ExpenseClaim } from '../src/models/expense-claim.model.js';
import { LeaveRequest } from '../src/models/leave-request.model.js';
import { LeaveType } from '../src/models/leave-type.model.js';
import { PayrollRun } from '../src/models/payroll-run.model.js';
import { SalaryStructure } from '../src/models/salary-structure.model.js';
import { User } from '../src/models/user.model.js';
import { calculateAttendance } from '../src/services/attendance.service.js';
import { calculatePayroll } from '../src/services/payroll.service.js';

const now = new Date();
const year = now.getUTCFullYear();
const month = now.getUTCMonth() + 1;
const day = (value) => new Date(Date.UTC(year, month - 1, value));

try {
  await connectDatabase();
  const [admin, annualLeave, unpaidLeave] = await Promise.all([
    User.findOne({ role: { $in: ['superadmin', 'admin'] }, status: 'active' }),
    LeaveType.findOneAndUpdate({ name: 'Annual Leave' }, { $setOnInsert: { maxBalance: 30, accrualPerMonth: 2 } }, { upsert: true, new: true }),
    LeaveType.findOneAndUpdate({ name: 'Unpaid Leave' }, { $setOnInsert: { maxBalance: 365, accrualPerMonth: 0 } }, { upsert: true, new: true }),
  ]);
  if (!admin) throw new Error('An active admin is required to seed attendance');
  const employees = await Employee.find({ status: 'active' }).populate('user', 'name email');
  const workdays = Array.from({ length: now.getUTCDate() }, (_, index) => index + 1).filter((date) => day(date).getUTCDay() !== 0);
  await Attendance.deleteMany({ employee: { $in: employees.map((employee) => employee._id) }, date: { $lt: new Date('2000-01-01') } });
  for (const [index, employee] of employees.entries()) {
    const site = index % 3 === 0;
    if (employee.employeeType !== (site ? 'site' : 'office')) await Employee.updateOne({ _id: employee._id }, { employeeType: site ? 'site' : 'office' });
    if (!await SalaryStructure.exists({ employee: employee._id })) await SalaryStructure.create({ employee: employee._id, ctc: 5000 + index * 300, basic: 3500 + index * 210, hra: 1500 + index * 90, effectiveFrom: day(1) });
    for (const [dayIndex, date] of workdays.entries()) {
      const attendanceDate = day(date);
      const status = date === now.getUTCDate() && index % 4 === 0 ? 'late' : dayIndex === 1 && index % 4 === 0 ? 'absent' : dayIndex === 2 && index % 4 === 1 ? 'half-day' : dayIndex === 3 && index % 4 === 2 ? 'late' : 'present';
      const checkIn = status === 'late' ? '10:45' : '09:00';
      const checkOut = site && dayIndex % 2 === 0 ? '19:30' : status === 'half-day' ? '13:00' : '18:00';
      const calculated = calculateAttendance({ employeeType: site ? 'site' : 'office', status, checkIn, checkOut });
      await Attendance.updateOne({ employee: employee._id, date: attendanceDate }, { $set: { employee: employee._id, date: attendanceDate, checkIn, checkOut, markedBy: admin._id, ...calculated } }, { upsert: true });
    }
    if (index % 3 === 0) await Advance.findOneAndUpdate({ employee: employee._id, reason: 'Demo salary advance' }, { $setOnInsert: { employee: employee._id, amount: 1500, reason: 'Demo salary advance', status: 'approved', deductionSchedule: { monthlyAmount: 300 }, approvedBy: admin._id } }, { upsert: true, new: true });
    if (index % 2 === 0) await LeaveRequest.findOneAndUpdate({ employee: employee._id, reason: 'Demo annual leave' }, { $setOnInsert: { employee: employee._id, leaveType: annualLeave._id, fromDate: day(Math.max(1, workdays[0])), toDate: day(Math.max(1, workdays[0])), days: 1, reason: 'Demo annual leave', status: 'approved', approvedBy: admin._id } }, { upsert: true });
    if (index % 5 === 0) await LeaveRequest.findOneAndUpdate({ employee: employee._id, reason: 'Demo unpaid leave' }, { $setOnInsert: { employee: employee._id, leaveType: unpaidLeave._id, fromDate: day(workdays[Math.min(2, workdays.length - 1)]), toDate: day(workdays[Math.min(2, workdays.length - 1)]), days: 1, reason: 'Demo unpaid leave', status: 'approved', approvedBy: admin._id } }, { upsert: true });
    await ExpenseClaim.findOneAndUpdate({ employee: employee._id, category: 'Demo reimbursement' }, { $setOnInsert: { employee: employee._id, category: 'Demo reimbursement', amount: 120 + index * 10, note: 'Demo local travel reimbursement', receipts: [{ key: `uploads/document/demo-${employee._id}.pdf`, contentType: 'application/pdf', originalName: 'demo-receipt.pdf', size: 1, checksum: 'demo' }], status: 'approved', approvedBy: admin._id } }, { upsert: true });
  }
  const payroll = await PayrollRun.findOne({ month, year });
  if (!payroll || payroll.status === 'draft') {
    const refreshedEmployees = await Employee.find({ status: 'active' }).populate('user', 'name email');
    const entries = await Promise.all(refreshedEmployees.map((employee) => calculatePayroll(employee, month, year)));
    if (payroll) { payroll.entries = entries.map(({ expenseClaimIds, ...entry }) => entry); await payroll.save(); }
    else await PayrollRun.create({ month, year, entries: entries.map(({ expenseClaimIds, ...entry }) => entry) });
  }
  console.log(`Employee demo data ready: ${employees.length} employees, ${workdays.length} attendance days, ${year}-${String(month).padStart(2, '0')} draft payroll.`);
} finally {
  await mongoose.disconnect();
}
