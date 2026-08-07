import mongoose from 'mongoose';
import { Advance } from '../models/advance.model.js';
import { Employee } from '../models/employee.model.js';
import { ExpenseClaim } from '../models/expense-claim.model.js';
import { PayrollRun } from '../models/payroll-run.model.js';
import { SalaryStructure } from '../models/salary-structure.model.js';
import { auditEvent } from '../services/audit.service.js';
import { notifyUsers } from '../services/notification.service.js';
import { createPayslipPdf } from '../services/payslip-pdf.service.js';
import { calculatePayroll, generateBankFile } from '../services/payroll.service.js';

const validPeriod = (month, year) => Number.isInteger(Number(month)) && Number(month) >= 1 && Number(month) <= 12 && Number.isInteger(Number(year)) && Number(year) >= 2000;
const amounts = (body) => ['ctc', 'basic', 'hra'].every((field) => Number.isFinite(Number(body[field])) && Number(body[field]) >= 0);

function cleanAllowances(allowances) { return (Array.isArray(allowances) ? allowances : []).map((item) => ({ name: String(item?.name || '').trim(), amount: Number(item?.amount) })).filter((item) => item.name && Number.isFinite(item.amount) && item.amount >= 0).slice(0, 20); }
const storedEntry = ({ expenseClaimIds, ...entry }) => entry;
async function employeesForPayroll(session) { const query = Employee.find({ status: 'active' }).populate('user', 'name email'); return session ? query.session(session) : query; }
async function payrollEntries(month, year, employees, session) { return Promise.all((employees || await employeesForPayroll(session)).map((employee) => calculatePayroll(employee, Number(month), Number(year), session))); }

export async function listSalaryStructures(req, res) { return res.json({ data: await SalaryStructure.find().populate({ path: 'employee', populate: { path: 'user', select: 'name email' } }).sort({ effectiveFrom: -1 }) }); }
export async function createSalaryStructure(req, res) {
  if (!amounts(req.body) || !req.body.employee || !req.body.effectiveFrom || !await Employee.exists({ _id: req.body.employee })) return res.status(400).json({ error: { message: 'Employee, effective date and non-negative monthly salary values are required' } });
  const structure = await SalaryStructure.create({ employee: req.body.employee, ctc: Number(req.body.ctc), basic: Number(req.body.basic), hra: Number(req.body.hra), allowances: cleanAllowances(req.body.allowances), effectiveFrom: req.body.effectiveFrom });
  await auditEvent(req, { action: 'hr.salary.create', entity: 'salary_structure', entityId: structure._id, after: { employee: structure.employee, effectiveFrom: structure.effectiveFrom } });
  return res.status(201).json({ data: structure });
}
export async function updateSalaryStructure(req, res) {
  if (!amounts(req.body) || !req.body.effectiveFrom) return res.status(400).json({ error: { message: 'Effective date and non-negative monthly salary values are required' } });
  const structure = await SalaryStructure.findByIdAndUpdate(req.params.id, { ctc: Number(req.body.ctc), basic: Number(req.body.basic), hra: Number(req.body.hra), allowances: cleanAllowances(req.body.allowances), effectiveFrom: req.body.effectiveFrom }, { new: true, runValidators: true });
  if (!structure) return res.status(404).json({ error: { message: 'Salary structure not found' } });
  await auditEvent(req, { action: 'hr.salary.update', entity: 'salary_structure', entityId: structure._id, after: { effectiveFrom: structure.effectiveFrom } });
  return res.json({ data: structure });
}

export async function listAdvances(req, res) { return res.json({ data: await Advance.find().populate({ path: 'employee', populate: { path: 'user', select: 'name email' } }).populate('approvedBy', 'name').sort({ createdAt: -1 }) }); }
export async function listMyAdvances(req, res) {
  const employee = await Employee.findOne({ user: req.user._id }).select('_id');
  if (!employee) return res.json({ data: [] });
  return res.json({ data: await Advance.find({ employee: employee._id }).sort({ createdAt: -1 }) });
}
export async function requestAdvance(req, res) {
  const employee = await Employee.findOne({ user: req.user._id, status: 'active' }).select('_id');
  const amount = Number(req.body?.amount); const monthlyAmount = Number(req.body?.deductionSchedule?.monthlyAmount);
  if (!employee || !String(req.body?.reason || '').trim() || !Number.isFinite(amount) || amount <= 0 || !Number.isFinite(monthlyAmount) || monthlyAmount <= 0) return res.status(400).json({ error: { message: 'Reason, amount and monthly deduction are required' } });
  const advance = await Advance.create({ employee: employee._id, amount, reason: String(req.body.reason).trim(), deductionSchedule: { monthlyAmount } });
  await auditEvent(req, { action: 'hr.advance.request', entity: 'advance', entityId: advance._id, after: { amount } });
  return res.status(201).json({ data: advance });
}
export async function createAdvance(req, res) {
  const amount = Number(req.body?.amount); const monthlyAmount = Number(req.body?.deductionSchedule?.monthlyAmount);
  if (!req.body.employee || !String(req.body.reason || '').trim() || !Number.isFinite(amount) || amount <= 0 || !Number.isFinite(monthlyAmount) || monthlyAmount <= 0 || !await Employee.exists({ _id: req.body.employee })) return res.status(400).json({ error: { message: 'Employee, reason, amount and monthly deduction are required' } });
  const advance = await Advance.create({ employee: req.body.employee, amount, reason: String(req.body.reason).trim(), deductionSchedule: { monthlyAmount } });
  await auditEvent(req, { action: 'hr.advance.create', entity: 'advance', entityId: advance._id, after: { employee: advance.employee, amount } });
  return res.status(201).json({ data: advance });
}
export async function decideAdvance(req, res) {
  const advance = await Advance.findById(req.params.id); const status = req.body?.status;
  if (!advance) return res.status(404).json({ error: { message: 'Advance not found' } });
  if (advance.status !== 'pending' || !['approved', 'rejected'].includes(status)) return res.status(400).json({ error: { message: 'Only pending advances can be approved or rejected' } });
  advance.status = status; advance.approvedBy = req.user._id; await advance.save();
  await auditEvent(req, { action: `hr.advance.${status}`, entity: 'advance', entityId: advance._id, after: { status } });
  if (status === 'approved') {
    const employee = await Employee.findById(advance.employee).select('user');
    await notifyUsers([employee?.user], { title: 'Advance approved', body: `Your advance of ${advance.amount} was approved.`, metadata: { type: 'hr.advance.approved', fromUserId: req.user._id } });
  }
  return res.json({ data: advance });
}

export async function previewPayroll(req, res) {
  if (!validPeriod(req.body?.month, req.body?.year)) return res.status(400).json({ error: { message: 'Valid payroll month and year are required' } });
  const employees = await employeesForPayroll();
  const entries = await Promise.all(employees.map(async (employee) => ({
    ...storedEntry(await calculatePayroll(employee, Number(req.body.month), Number(req.body.year))),
    employee: { _id: employee._id, user: employee.user },
  })));
  return res.json({ data: { month: Number(req.body.month), year: Number(req.body.year), entries } });
}
export async function createPayrollRun(req, res) {
  if (!validPeriod(req.body?.month, req.body?.year)) return res.status(400).json({ error: { message: 'Valid payroll month and year are required' } });
  if (await PayrollRun.exists({ month: Number(req.body.month), year: Number(req.body.year) })) return res.status(409).json({ error: { message: 'A payroll run already exists for this period' } });
  const run = await PayrollRun.create({ month: Number(req.body.month), year: Number(req.body.year), entries: (await payrollEntries(req.body.month, req.body.year)).map(storedEntry) });
  await auditEvent(req, { action: 'hr.payroll.create', entity: 'payroll_run', entityId: run._id, after: { month: run.month, year: run.year } });
  return res.status(201).json({ data: run });
}
export async function listPayrollRuns(req, res) { return res.json({ data: await PayrollRun.find().sort({ year: -1, month: -1 }) }); }
export async function getPayrollRun(req, res) {
  const run = await PayrollRun.findById(req.params.id).populate({ path: 'entries.employee', populate: { path: 'user', select: 'name email' } });
  if (!run) return res.status(404).json({ error: { message: 'Payroll run not found' } });
  return res.json({ data: run });
}
export async function processPayrollRun(req, res) {
  const session = await mongoose.startSession();
  let run;
  try {
    await session.withTransaction(async () => {
      run = await PayrollRun.findOne({ _id: req.params.id, status: 'draft' }).session(session);
      if (!run) {
        const exists = await PayrollRun.exists({ _id: req.params.id }).session(session);
        const error = new Error(exists ? 'Payroll run is already processed' : 'Payroll run not found');
        error.statusCode = exists ? 409 : 404;
        throw error;
      }
      const entries = await payrollEntries(run.month, run.year, undefined, session);
      run.entries = entries.map(storedEntry);
      for (const entry of entries) {
        const advances = await Advance.find({ employee: entry.employee, status: 'approved' }).session(session);
        for (const advance of advances) { advance.deductedAmount += Math.min(advance.deductionSchedule.monthlyAmount, advance.amount - advance.deductedAmount); if (advance.deductedAmount >= advance.amount) advance.status = 'settled'; await advance.save({ session }); }
        if (entry.expenseClaimIds.length) await ExpenseClaim.updateMany({ _id: { $in: entry.expenseClaimIds }, status: 'approved', reimbursedInPayroll: null }, { $set: { reimbursedInPayroll: run._id } }, { session });
      }
      run.status = 'processed'; run.processedBy = req.user._id; run.processedAt = new Date(); await run.save({ session });
    });
  } finally {
    await session.endSession();
  }
  await auditEvent(req, { action: 'hr.payroll.process', entity: 'payroll_run', entityId: run._id, after: { month: run.month, year: run.year } });
  const employees = await Employee.find({ _id: { $in: run.entries.map((entry) => entry.employee) } }).populate('user', 'name email').populate('department', 'name').populate('designation', 'name');
  const employeeById = new Map(employees.map((employee) => [String(employee._id), employee]));
  await Promise.all(run.entries.map(async (entry) => {
    const employee = employeeById.get(String(entry.employee));
    const salary = employee && await SalaryStructure.findOne({ employee: employee._id, effectiveFrom: { $lte: new Date(Date.UTC(run.year, run.month, 1)) } }).sort({ effectiveFrom: -1 });
    const attachment = employee && await createPayslipPdf({ employee, entry, salary, month: run.month, year: run.year });
    return notifyUsers([employee?.user], {
      title: `Salary slip — ${run.year}-${String(run.month).padStart(2, '0')}`,
      body: `Gross pay: ${entry.grossPay} · Deductions: ${entry.deductions} · Net pay: ${entry.netPay}. Your PDF payslip is attached.`,
      metadata: { type: 'hr.payroll.payslip', fromUserId: req.user._id, payrollRunId: run._id },
      attachments: attachment ? [{ filename: `payslip-${run.year}-${String(run.month).padStart(2, '0')}.pdf`, content: attachment, contentType: 'application/pdf' }] : undefined,
    });
  }));
  return res.json({ data: run });
}
export async function downloadBankFile(req, res) {
  const run = await PayrollRun.findById(req.params.id).populate({ path: 'entries.employee', populate: { path: 'user', select: 'name' } });
  if (!run) return res.status(404).json({ error: { message: 'Payroll run not found' } });
  res.type('text/csv').attachment(`payroll-${run.year}-${String(run.month).padStart(2, '0')}.csv`);
  return res.send(generateBankFile(run));
}
export async function previewSettlement(req, res) {
  const employee = await Employee.findOne({ _id: req.params.employeeId, status: { $in: ['resigned', 'terminated'] } }).populate('user', 'name email');
  if (!employee || !validPeriod(req.query.month, req.query.year)) return res.status(400).json({ error: { message: 'An offboarded employee and valid period are required' } });
  return res.json({ data: await calculatePayroll(employee, Number(req.query.month), Number(req.query.year)) });
}
