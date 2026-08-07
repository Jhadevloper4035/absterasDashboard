import { Advance } from '../models/advance.model.js';
import { Attendance } from '../models/attendance.model.js';
import { Employee } from '../models/employee.model.js';
import { ExpenseClaim } from '../models/expense-claim.model.js';
import { LeaveRequest } from '../models/leave-request.model.js';
import { PayrollRun } from '../models/payroll-run.model.js';

export async function hrDashboard(req, res) {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start); end.setUTCDate(end.getUTCDate() + 1);
  const [activeEmployees, todayAttendance, pendingLeaves, pendingAdvances, pendingExpenses, payroll] = await Promise.all([
    Employee.countDocuments({ status: 'active' }),
    Attendance.countDocuments({ date: { $gte: start, $lt: end } }),
    LeaveRequest.countDocuments({ status: 'pending' }),
    Advance.countDocuments({ status: 'pending' }),
    ExpenseClaim.countDocuments({ status: 'pending' }),
    PayrollRun.findOne({ month: now.getUTCMonth() + 1, year: now.getUTCFullYear() }).select('status entries').lean(),
  ]);
  return res.json({ data: { activeEmployees, todayAttendance, pendingLeaves, pendingAdvances, pendingExpenses, payroll: payroll ? { status: payroll.status, employees: payroll.entries.length } : null } });
}
