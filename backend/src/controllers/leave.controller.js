import { Employee } from '../models/employee.model.js';
import { Holiday } from '../models/holiday.model.js';
import { LeaveBalance } from '../models/leave-balance.model.js';
import { LeaveRequest } from '../models/leave-request.model.js';
import { LeaveType } from '../models/leave-type.model.js';
import { Attendance } from '../models/attendance.model.js';
import { PaidLeaveAllocation } from '../models/paid-leave-allocation.model.js';
import { auditEvent } from '../services/audit.service.js';
import { notifyUsers } from '../services/notification.service.js';
import { dayAtMidnight, leaveAttendanceDates, leaveDays } from '../services/leave.service.js';

const year = (date) => new Date(date).getUTCFullYear();
const mine = async (user) => Employee.findOne({ user: user._id }).select('_id');

export async function listLeaveTypes(req, res) { return res.json({ data: await LeaveType.find().sort({ name: 1 }) }); }
export async function createLeaveType(req, res) {
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: { message: 'Leave type name is required' } });
  const isPaid = /^medical leave$/i.test(name);
  const type = await LeaveType.create({ name, isPaid, accrualPerMonth: isPaid ? 1 : 0, maxBalance: isPaid ? 1 : 0 });
  await auditEvent(req, { action: 'hr.leave_type.create', entity: 'leave_type', entityId: type._id, after: { name } });
  return res.status(201).json({ data: type });
}
export async function updateLeaveType(req, res) {
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: { message: 'Leave type name is required' } });
  const isPaid = /^medical leave$/i.test(name);
  const type = await LeaveType.findByIdAndUpdate(req.params.id, { name, isPaid, accrualPerMonth: isPaid ? 1 : 0, maxBalance: isPaid ? 1 : 0 }, { new: true, runValidators: true });
  if (!type) return res.status(404).json({ error: { message: 'Leave type not found' } });
  await auditEvent(req, { action: 'hr.leave_type.update', entity: 'leave_type', entityId: type._id, after: { name } });
  return res.json({ data: type });
}
export async function deleteLeaveType(req, res) {
  if (await LeaveRequest.exists({ leaveType: req.params.id })) return res.status(409).json({ error: { message: 'Cannot delete a leave type with requests' } });
  const type = await LeaveType.findByIdAndDelete(req.params.id);
  if (!type) return res.status(404).json({ error: { message: 'Leave type not found' } });
  await auditEvent(req, { action: 'hr.leave_type.delete', entity: 'leave_type', entityId: type._id, before: { name: type.name } });
  return res.json({ data: { id: String(type._id) } });
}

export async function listLeaveBalances(req, res) {
  const employee = req.hrAccess === 'manage' && req.query.employee ? { _id: req.query.employee } : await mine(req.user);
  if (!employee) return res.json({ data: [] });
  return res.json({ data: await LeaveBalance.find({ employee: employee._id, year: Number(req.query.year || new Date().getUTCFullYear()) }).populate('leaveType', 'name isPaid maxBalance accrualPerMonth').sort({ createdAt: 1 }) });
}

export async function listLeaveRequests(req, res) {
  const employee = req.hrAccess === 'manage' ? null : await mine(req.user);
  if (req.hrAccess !== 'manage' && !employee) return res.json({ data: [] });
  const query = req.hrAccess === 'manage' ? {} : { employee: employee._id };
  if (req.query.status) query.status = req.query.status;
  const records = await LeaveRequest.find(query).populate({ path: 'employee', populate: { path: 'user', select: 'name email' } }).populate('leaveType', 'name isPaid').populate('approvedBy', 'name').sort({ createdAt: -1 });
  return res.json({ data: records });
}

export async function createLeaveRequest(req, res) {
  const employee = await mine(req.user);
  const fromDate = dayAtMidnight(req.body?.fromDate);
  const toDate = dayAtMidnight(req.body?.toDate);
  const leaveType = await LeaveType.findById(req.body?.leaveType);
  if (!employee || !fromDate || !toDate || !leaveType) return res.status(400).json({ error: { message: 'Valid leave type and date range are required' } });
  if (await LeaveRequest.exists({ employee: employee._id, status: { $in: ['pending', 'approved'] }, fromDate: { $lte: toDate }, toDate: { $gte: fromDate } })) return res.status(409).json({ error: { message: 'This leave overlaps an existing request' } });
  const holidays = await Holiday.find({ date: { $gte: fromDate, $lte: toDate } }).select('date');
  const days = leaveDays(req.body.fromDate, req.body.toDate, holidays.map((holiday) => holiday.date));
  if (!days) return res.status(400).json({ error: { message: 'Leave range has no working days' } });
  const request = await LeaveRequest.create({ employee: employee._id, leaveType: leaveType._id, fromDate, toDate, days, reason: String(req.body.reason || '').trim() });
  await auditEvent(req, { action: 'hr.leave.apply', entity: 'leave_request', entityId: request._id, after: { days, leaveType: leaveType.name } });
  return res.status(201).json({ data: request });
}

export async function decideLeaveRequest(req, res) {
  const request = await LeaveRequest.findById(req.params.id).populate('leaveType', 'isPaid');
  const status = req.body?.status;
  if (!request) return res.status(404).json({ error: { message: 'Leave request not found' } });
  if (request.status !== 'pending' || !['approved', 'rejected'].includes(status)) return res.status(400).json({ error: { message: 'Only pending requests can be approved or rejected' } });
  if (req.body?.paid !== undefined && typeof req.body.paid !== 'boolean') return res.status(400).json({ error: { message: 'Paid leave choice must be true or false' } });
  if (status === 'approved') {
    if (typeof req.body.paid === 'boolean') {
      request.paidDays = req.body.paid ? request.days : 0;
    } else if (request.leaveType.isPaid) {
      const month = request.fromDate.toISOString().slice(0, 7);
      const monthStart = new Date(`${month}-01T00:00:00.000Z`);
      const nextMonthStart = new Date(Date.UTC(request.fromDate.getUTCFullYear(), request.fromDate.getUTCMonth() + 1, 1));
      const hasExistingPaidLeave = await LeaveRequest.exists({ employee: request.employee, status: 'approved', paidDays: { $gt: 0 }, _id: { $ne: request._id }, fromDate: { $gte: monthStart, $lt: nextMonthStart } });
      if (hasExistingPaidLeave) {
        request.paidDays = 0;
      } else {
        try {
          await PaidLeaveAllocation.create({ employee: request.employee, month, request: request._id });
          request.paidDays = Math.min(1, request.days);
        } catch (error) {
          if (error?.code !== 11000) throw error;
          request.paidDays = 0;
        }
      }
    }
    const holidays = await Holiday.find({ date: { $gte: request.fromDate, $lte: request.toDate } }).select('date');
    await Attendance.bulkWrite(leaveAttendanceDates(request.fromDate, request.toDate, holidays.map((holiday) => holiday.date)).map((date) => ({
      updateOne: {
        filter: { employee: request.employee, date },
        update: { $set: { employee: request.employee, date, status: 'leave', workMinutes: 0, isShortLeave: false, overtimeMinutes: 0, markedBy: req.user._id }, $unset: { checkIn: 1, checkOut: 1, isRegularized: 1, regularizationReason: 1 } },
        upsert: true,
      },
    })));
  }
  if (status === 'rejected') request.paidDays = 0;
  request.status = status;
  request.approvedBy = req.user._id;
  request.decisionNote = String(req.body.decisionNote || '').trim();
  await request.save();
  await auditEvent(req, { action: `hr.leave.${status}`, entity: 'leave_request', entityId: request._id, after: { status } });
  const employee = await Employee.findById(request.employee).select('user');
  await notifyUsers([employee?.user], { title: `Leave ${status}`, body: `${request.days} day(s) ${status}.`, metadata: { type: `hr.leave.${status}`, fromUserId: req.user._id } });
  return res.json({ data: request });
}

export async function creditCompOff(req, res) {
  const employee = await Employee.findById(req.body?.employee);
  const leaveType = await LeaveType.findOne({ name: { $regex: /^comp-off$/i } });
  const date = dayAtMidnight(req.body?.date);
  const days = Number(req.body?.days || 1);
  if (!employee || !leaveType || !date || !Number.isFinite(days) || days <= 0) return res.status(400).json({ error: { message: 'A configured comp-off type, employee, date and positive days are required' } });
  const balance = await LeaveBalance.findOneAndUpdate({ employee: employee._id, leaveType: leaveType._id, year: year(date) }, { $setOnInsert: { employee: employee._id, leaveType: leaveType._id, year: year(date), balance: 0 }, $inc: { balance: days } }, { upsert: true, new: true });
  if (balance.balance > leaveType.maxBalance) { balance.balance = leaveType.maxBalance; await balance.save(); }
  const request = await LeaveRequest.create({ employee: employee._id, leaveType: leaveType._id, fromDate: date, toDate: date, days, reason: String(req.body.reason || '').trim(), status: 'approved', approvedBy: req.user._id });
  await auditEvent(req, { action: 'hr.leave.comp_off', entity: 'leave_request', entityId: request._id, after: { days } });
  return res.status(201).json({ data: { request, balance } });
}

export async function encashLeave(req, res) {
  const employee = await Employee.findById(req.body?.employee);
  const leaveType = await LeaveType.findById(req.body?.leaveType);
  const days = Number(req.body?.days);
  const date = dayAtMidnight(req.body?.date || new Date().toISOString().slice(0, 10));
  if (!employee || !leaveType || !date || !Number.isFinite(days) || days <= 0) return res.status(400).json({ error: { message: 'Employee, leave type and positive days are required' } });
  const balance = await LeaveBalance.findOneAndUpdate({ employee: employee._id, leaveType: leaveType._id, year: year(date), balance: { $gte: days } }, { $inc: { balance: -days } }, { new: true });
  if (!balance) return res.status(400).json({ error: { message: 'Insufficient leave balance' } });
  const request = await LeaveRequest.create({ employee: employee._id, leaveType: leaveType._id, fromDate: date, toDate: date, days, status: 'encashed', approvedBy: req.user._id, encashedAt: new Date(), decisionNote: String(req.body.note || '').trim() });
  await auditEvent(req, { action: 'hr.leave.encash', entity: 'leave_request', entityId: request._id, after: { days } });
  return res.status(201).json({ data: { payoutDays: days, encashment: request } });
}
