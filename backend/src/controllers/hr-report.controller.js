import { Attendance } from '../models/attendance.model.js';
import { Employee } from '../models/employee.model.js';
import { LeaveRequest } from '../models/leave-request.model.js';
import { PayrollRun } from '../models/payroll-run.model.js';

const date = (value, end = false) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null;
  const result = new Date(`${value}T${end ? '23:59:59.999' : '00:00:00.000'}Z`);
  return Number.isNaN(result.getTime()) ? null : result;
};
const dates = (query) => ({ from: date(query.from) || new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)), to: date(query.to, true) || new Date() });
async function filteredEmployees(query) {
  const filter = {};
  if (query.department) filter.department = query.department;
  if (query.employeeType) filter.employeeType = query.employeeType;
  return Employee.find(filter).select('_id status joiningDate lastWorkingDate department employeeType');
}

export async function attendanceLeaveReport(req, res) {
  const { from, to } = dates(req.query); const employees = await filteredEmployees(req.query); const ids = employees.map((employee) => employee._id);
  const [attendance, leave] = await Promise.all([
    Attendance.aggregate([{ $match: { employee: { $in: ids }, date: { $gte: from, $lte: to } } }, { $group: { _id: '$status', count: { $sum: 1 }, overtimeMinutes: { $sum: '$overtimeMinutes' } } }]),
    LeaveRequest.aggregate([{ $match: { employee: { $in: ids }, fromDate: { $lte: to }, toDate: { $gte: from } } }, { $group: { _id: '$status', count: { $sum: 1 }, days: { $sum: '$days' } } }]),
  ]);
  return res.json({ data: { employees: employees.length, attendance, leave } });
}

export async function payrollCostReport(req, res) {
  const { from, to } = dates(req.query);
  const employees = await filteredEmployees(req.query);
  const employeeIds = new Set(employees.map((employee) => String(employee._id)));
  const runs = (await PayrollRun.find({ status: 'processed' })).filter((run) => { const period = new Date(Date.UTC(run.year, run.month - 1, 1)); return period >= new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1)) && period <= new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1)); });
  const periods = runs.map((run) => {
    const entries = req.query.department || req.query.employeeType ? run.entries.filter((entry) => employeeIds.has(String(entry.employee))) : run.entries;
    return { month: run.month, year: run.year, grossPay: entries.reduce((total, entry) => total + entry.grossPay, 0), deductions: entries.reduce((total, entry) => total + entry.deductions, 0), netPay: entries.reduce((total, entry) => total + entry.netPay, 0), reimbursements: entries.reduce((total, entry) => total + (entry.reimbursementPay || 0), 0) };
  });
  return res.json({ data: { periods, totals: periods.reduce((total, period) => ({ grossPay: total.grossPay + period.grossPay, deductions: total.deductions + period.deductions, netPay: total.netPay + period.netPay, reimbursements: total.reimbursements + period.reimbursements }), { grossPay: 0, deductions: 0, netPay: 0, reimbursements: 0 }) } });
}

export async function headcountAttritionReport(req, res) {
  const { from, to } = dates(req.query); const employees = await filteredEmployees(req.query);
  const active = employees.filter((employee) => employee.joiningDate <= to && (employee.status === 'active' || employee.lastWorkingDate >= to)).length;
  const joined = employees.filter((employee) => employee.joiningDate >= from && employee.joiningDate <= to).length;
  const exited = employees.filter((employee) => ['resigned', 'terminated'].includes(employee.status) && employee.lastWorkingDate >= from && employee.lastWorkingDate <= to).length;
  return res.json({ data: { active, joined, exited, attritionRate: active ? Number(((exited / active) * 100).toFixed(2)) : 0 } });
}
