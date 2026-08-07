import { Advance } from '../models/advance.model.js';
import { Attendance } from '../models/attendance.model.js';
import { ExpenseClaim } from '../models/expense-claim.model.js';
import { Holiday } from '../models/holiday.model.js';
import { LeaveRequest } from '../models/leave-request.model.js';
import { SalaryStructure } from '../models/salary-structure.model.js';
import { leaveAttendanceDates } from './leave.service.js';

const monthBounds = (month, year) => ({ from: new Date(Date.UTC(year, month - 1, 1)), to: new Date(Date.UTC(year, month, 1)) });
const money = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
const sundayCount = (from, to) => { let count = 0; for (const date = new Date(from); date < to; date.setUTCDate(date.getUTCDate() + 1)) if (date.getUTCDay() === 0) count++; return count; };

const inSession = (query, session) => session ? query.session(session) : query;
export const unpaidLeaveDaysForPayroll = (requests, from, to, holidayDates = []) => requests.reduce((total, request) => {
  const dates = leaveAttendanceDates(request.fromDate, request.toDate, holidayDates);
  const periodDates = dates.filter((date) => date >= from && date < to);
  const paidDays = Math.min(request.paidDays ?? (request.leaveType?.isPaid ? 1 : 0), dates.length);
  const paidInPeriod = dates.slice(0, paidDays).filter((date) => date >= from && date < to).length;
  return total + periodDates.length - paidInPeriod;
}, 0);

export async function calculatePayroll(employee, month, year, session) {
  const { from, to } = monthBounds(month, year);
  const structure = await inSession(SalaryStructure.findOne({ employee: employee._id, effectiveFrom: { $lte: to } }).sort({ effectiveFrom: -1 }), session);
  if (!structure) throw new Error(`${employee.user?.name || 'Employee'} has no salary structure`);
  const [attendance, unpaidLeaves, encashments, advances, expenses] = await Promise.all([
    inSession(Attendance.find({ employee: employee._id, date: { $gte: from, $lt: to } }), session),
    inSession(LeaveRequest.find({ employee: employee._id, status: 'approved', fromDate: { $lt: to }, toDate: { $gte: from } }).populate('leaveType', 'isPaid'), session),
    inSession(LeaveRequest.find({ employee: employee._id, status: 'encashed', encashedAt: { $gte: from, $lt: to } }), session),
    inSession(Advance.find({ employee: employee._id, status: 'approved' }), session),
    inSession(ExpenseClaim.find({ employee: employee._id, status: 'approved', reimbursedInPayroll: null }), session),
  ]);
  const leaveFrom = unpaidLeaves.reduce((earliest, request) => request.fromDate < earliest ? request.fromDate : earliest, from);
  const leaveTo = unpaidLeaves.reduce((latest, request) => request.toDate > latest ? request.toDate : latest, new Date(to - 1));
  const holidayRecords = await inSession(Holiday.find({ date: { $gte: leaveFrom, $lte: leaveTo } }).select('date'), session);
  const calendarDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const periodHolidays = holidayRecords.filter((holiday) => holiday.date >= from && holiday.date < to);
  const holidays = periodHolidays.length + sundayCount(from, to) - periodHolidays.filter((holiday) => new Date(holiday.date).getUTCDay() === 0).length;
  const workingDays = Math.max(calendarDays - holidays, 1);
  const absenceDays = attendance.reduce((total, record) => total + (record.status === 'absent' ? 1 : record.status === 'half-day' ? 0.5 : 0), 0);
  const unpaidLeaveDays = unpaidLeaveDaysForPayroll(unpaidLeaves, from, to, holidayRecords.map((holiday) => holiday.date));
  const payableDays = Math.max(workingDays - absenceDays - unpaidLeaveDays, 0);
  const monthlyGross = structure.basic + structure.hra + structure.allowances.reduce((total, allowance) => total + allowance.amount, 0);
  const dailyPay = monthlyGross / workingDays;
  const unpaidDeduction = money((workingDays - payableDays) * dailyPay);
  const encashmentPay = money(encashments.reduce((total, request) => total + request.days, 0) * dailyPay);
  const advanceDeducted = money(advances.reduce((total, advance) => total + Math.min(advance.deductionSchedule.monthlyAmount, advance.amount - advance.deductedAmount), 0));
  const reimbursementPay = money(expenses.reduce((total, expense) => total + expense.amount, 0));
  const grossPay = money(monthlyGross + encashmentPay + reimbursementPay);
  const deductions = money(unpaidDeduction + advanceDeducted);
  return { employee: employee._id, payableDays, workingDays, grossPay, deductions, netPay: money(grossPay - deductions), bonus: 0, advanceDeducted, unpaidDeduction, encashmentPay, reimbursementPay, expenseClaimIds: expenses.map((expense) => expense._id) };
}

export function generateBankFile(payrollRun) {
  const quote = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  return ['employee_id,employee_name,net_pay', ...payrollRun.entries.map((entry) => [entry.employee._id || entry.employee, entry.employee.user?.name || '', entry.netPay].map(quote).join(','))].join('\n');
}
