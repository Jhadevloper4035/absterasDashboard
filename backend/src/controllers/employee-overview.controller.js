import { Advance } from '../models/advance.model.js';
import { Attendance } from '../models/attendance.model.js';
import { Employee } from '../models/employee.model.js';
import { ExpenseClaim } from '../models/expense-claim.model.js';
import { LeaveRequest } from '../models/leave-request.model.js';
import { PayrollRun } from '../models/payroll-run.model.js';
import { SalaryStructure } from '../models/salary-structure.model.js';

const period = (value) => {
  const match = String(value || '').match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  if (!match) return null;
  const [year, month] = match.slice(1).map(Number);
  return { year, month, from: new Date(Date.UTC(year, month - 1, 1)), to: new Date(Date.UTC(year, month, 1)) };
};

export async function employeeMonthlyOverview(req, res) {
  const selectedPeriod = period(req.query.month || new Date().toISOString().slice(0, 7));
  if (!selectedPeriod) return res.status(400).json({ error: { message: 'Month must use YYYY-MM format' } });
  if (req.hrAccess === 'manage' && req.query.employee && !/^[a-f\d]{24}$/i.test(req.query.employee)) return res.status(400).json({ error: { message: 'Invalid employee' } });
  const employee = req.hrAccess === 'manage' && req.query.employee
    ? await Employee.findById(req.query.employee).populate('user department designation', 'name email')
    : await Employee.findOne({ user: req.user._id }).populate('user department designation', 'name email');
  if (!employee) return res.status(404).json({ error: { message: req.hrAccess === 'manage' ? 'Select an employee' : 'Employee profile not found' } });
  const { year, month, from, to } = selectedPeriod;
  const [attendance, leaves, advances, reimbursements, salary, run] = await Promise.all([
    Attendance.find({ employee: employee._id, date: { $gte: from, $lt: to } }).sort({ date: 1 }),
    LeaveRequest.find({ employee: employee._id, fromDate: { $lt: to }, toDate: { $gte: from } }).populate('leaveType', 'name').sort({ fromDate: 1 }),
    Advance.find({ employee: employee._id, createdAt: { $lt: to } }).sort({ createdAt: -1 }),
    ExpenseClaim.find({ employee: employee._id, createdAt: { $gte: from, $lt: to } }).sort({ createdAt: -1 }),
    SalaryStructure.findOne({ employee: employee._id, effectiveFrom: { $lt: to } }).sort({ effectiveFrom: -1 }),
    PayrollRun.findOne({ year, month }).select('status entries'),
  ]);
  const payroll = run?.entries.find((entry) => String(entry.employee) === String(employee._id));
  const attendanceSummary = attendance.reduce((summary, record) => ({ ...summary, [record.status]: (summary[record.status] || 0) + 1 }), {});
  const salaryData = salary && { ...salary.toObject(), monthlyGross: salary.basic + salary.hra + salary.allowances.reduce((total, allowance) => total + allowance.amount, 0) };
  return res.json({ data: { month: `${year}-${String(month).padStart(2, '0')}`, employee, salary: salaryData, payroll: payroll ? { ...payroll.toObject(), status: run.status } : null, attendance: { summary: attendanceSummary, records: attendance }, leaves, advances, reimbursements } });
}
