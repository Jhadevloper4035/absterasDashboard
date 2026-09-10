import { Attendance, ATTENDANCE_STATUSES } from '../models/attendance.model.js';
import { Employee } from '../models/employee.model.js';
import { Holiday } from '../models/holiday.model.js';
import { LeaveRequest } from '../models/leave-request.model.js';
import { auditEvent } from '../../../services/audit.service.js';
import { calculateAttendance } from '../services/attendance.service.js';
import { createAttendanceReportPdf } from '../services/attendance-report-pdf.service.js';
import { notifyEmployeeRequestDecision, notifyHrApprovers } from '../services/approval-notification.service.js';

const dateAtMidnight = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
};
const validTime = (value) => value === undefined || value === '' || /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const CORRECTABLE_STATUSES = ['present', 'absent', 'half-day', 'late'];

export async function listAttendance(req, res) {
  const page = Math.max(Number(req.query.page || 1), 1);
  const limit = Math.min(Math.max(Number(req.query.limit || 25), 1), 100);
  const canManage = req.hrAccess === 'manage';
  const query = canManage ? {} : { employee: { $in: (await Employee.find({ user: req.user._id }).select('_id')).map((employee) => employee._id) } };
  if (canManage && req.query.employee) {
    if (!/^[a-f\d]{24}$/i.test(req.query.employee)) return res.status(400).json({ error: { message: 'Invalid employee' } });
    query.employee = req.query.employee;
  } else if (canManage && req.query.department) {
    const employees = await Employee.find({ department: req.query.department }).select('_id');
    query.employee = { $in: employees.map((employee) => employee._id) };
  }
  if (req.query.from || req.query.to) {
    query.date = {};
    if (req.query.from) query.date.$gte = dateAtMidnight(req.query.from);
    if (req.query.to) query.date.$lte = dateAtMidnight(req.query.to);
  }
  const [records, total] = await Promise.all([
    Attendance.find(query).populate({ path: 'employee', populate: [{ path: 'user', select: 'name email' }, { path: 'department', select: 'name' }] }).populate('markedBy', 'name email').sort({ date: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Attendance.countDocuments(query),
  ]);
  return res.json({ data: records, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } });
}

export async function downloadAttendanceReport(req, res) {
  const from = dateAtMidnight(req.query.from); const to = dateAtMidnight(req.query.to);
  if (!from || !to || from > to || !req.query.employee || !/^[a-f\d]{24}$/i.test(req.query.employee)) return res.status(400).json({ error: { message: 'Select an employee and a valid date range' } });
  const employee = await Employee.findById(req.query.employee).populate('user', 'name email').populate('department', 'name');
  if (!employee) return res.status(404).json({ error: { message: 'Employee not found' } });
  const records = await Attendance.find({ employee: employee._id, date: { $gte: from, $lte: to } }).sort({ date: 1 });
  const pdf = await createAttendanceReportPdf({ employee, records, from, to });
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="attendance-${String(employee._id)}-${req.query.from}-${req.query.to}.pdf"` });
  return res.send(pdf);
}

export async function markAttendance(req, res) {
  const date = dateAtMidnight(req.body?.date);
  const records = req.body?.records;
  if (!date || !Array.isArray(records) || !records.length || records.length > 500) return res.status(400).json({ error: { message: 'Date and 1–500 attendance records are required' } });
  if (date > dateAtMidnight(new Date().toISOString().slice(0, 10))) return res.status(400).json({ error: { message: 'Attendance cannot be marked for a future date' } });
  if (date.getUTCDay() === 0) return res.status(400).json({ error: { message: 'Attendance cannot be marked on Sunday' } });
  if (await Holiday.exists({ date })) return res.status(400).json({ error: { message: 'Attendance cannot be marked on a holiday' } });
  if (records.some((record) => !ATTENDANCE_STATUSES.includes(record?.status))) return res.status(400).json({ error: { message: 'Invalid attendance status' } });
  const employeeIds = [...new Set(records.map((record) => String(record.employee)))];
  if (await LeaveRequest.exists({ employee: { $in: employeeIds }, status: 'approved', fromDate: { $lte: date }, toDate: { $gte: date } })) return res.status(409).json({ error: { message: 'Approved leave cannot be overwritten' } });
  const employees = await Employee.find({ _id: { $in: employeeIds }, status: 'active' }).select('_id employeeType');
  if (employees.length !== employeeIds.length) return res.status(400).json({ error: { message: 'Attendance can only be marked for active employees' } });
  const employeeById = new Map(employees.map((employee) => [String(employee._id), employee]));
  const operations = records.map((record) => {
    const calculated = calculateAttendance({ employeeType: employeeById.get(String(record.employee)).employeeType, status: record.status, checkIn: record.checkIn, checkOut: record.checkOut });
    return {
      updateOne: {
        filter: { employee: record.employee, date },
        update: { $set: { date, checkIn: record.checkIn || undefined, checkOut: record.checkOut || undefined, status: calculated.status, workMinutes: calculated.workMinutes, isShortLeave: calculated.isShortLeave, overtimeMinutes: calculated.overtimeMinutes, isRegularized: Boolean(record.regularizationReason), regularizationReason: String(record.regularizationReason || '').trim() || undefined, markedBy: req.user._id } },
        upsert: true,
      },
    };
  });
  await Attendance.bulkWrite(operations);
  await auditEvent(req, { action: 'hr.attendance.mark', entity: 'attendance', entityId: req.body.date, details: { records: records.length } });
  return res.json({ data: { date: req.body.date, marked: records.length } });
}

export async function requestAttendanceCorrection(req, res) {
  const reason = String(req.body?.reason || '').trim();
  const requestedStatus = req.body?.requestedStatus;
  const requestedCheckIn = String(req.body?.requestedCheckIn || '').trim();
  const requestedCheckOut = String(req.body?.requestedCheckOut || '').trim();
  if (reason.length < 3 || reason.length > 1000 || !CORRECTABLE_STATUSES.includes(requestedStatus) || !validTime(requestedCheckIn) || !validTime(requestedCheckOut)) return res.status(400).json({ error: { message: 'Provide a valid requested attendance status, times, and correction reason' } });
  const correctionRequest = { status: 'pending', reason, requestedStatus, requestedCheckIn: requestedCheckIn || undefined, requestedCheckOut: requestedCheckOut || undefined, requestedAt: new Date() };
  let attendance;
  if (req.params.id) {
    attendance = await Attendance.findById(req.params.id);
    if (!attendance) return res.status(404).json({ error: { message: 'Attendance record not found' } });
    if (!await Employee.exists({ _id: attendance.employee, user: req.user._id })) return res.status(403).json({ error: { message: 'Forbidden' } });
  } else {
    const date = dateAtMidnight(req.body?.date);
    if (!date || date > new Date() || date.getUTCDay() === 0 || await Holiday.exists({ date })) return res.status(400).json({ error: { message: 'Choose a past working day for the correction request' } });
    const employee = await Employee.findOne({ user: req.user._id }).select('_id');
    if (!employee) return res.status(404).json({ error: { message: 'Employee profile not found' } });
    attendance = await Attendance.findOne({ employee: employee._id, date });
    if (!attendance) {
      attendance = await Attendance.create({ employee: employee._id, date, status: 'absent', correctionRequest });
      await auditEvent(req, { action: 'hr.attendance.correction.request', entity: 'attendance', entityId: attendance._id, after: { requestedStatus } });
      await notifyHrApprovers(req.user, { title: 'Attendance correction awaiting approval', body: `${req.user.name || 'An employee'} requested a ${requestedStatus} correction for ${req.body.date}.`, link: '/hr/attendance' });
      return res.status(201).json({ data: attendance });
    }
  }
  if (attendance.correctionRequest?.status === 'pending') return res.status(409).json({ error: { message: 'A correction request is already pending for this date' } });
  attendance.correctionRequest = correctionRequest;
  await attendance.save();
  await auditEvent(req, { action: 'hr.attendance.correction.request', entity: 'attendance', entityId: attendance._id, after: { requestedStatus } });
  await notifyHrApprovers(req.user, { title: 'Attendance correction awaiting approval', body: `${req.user.name || 'An employee'} requested a ${requestedStatus} correction.`, link: '/hr/attendance' });
  return res.status(201).json({ data: attendance });
}

export async function decideAttendanceCorrection(req, res) {
  const decision = req.body?.status;
  if (!['approved', 'rejected'].includes(decision)) return res.status(400).json({ error: { message: 'Correction status must be approved or rejected' } });
  const attendance = await Attendance.findById(req.params.id);
  if (!attendance) return res.status(404).json({ error: { message: 'Attendance record not found' } });
  if (attendance.correctionRequest?.status !== 'pending') return res.status(409).json({ error: { message: 'This correction request is no longer pending' } });
  let employee;
  if (decision === 'approved') {
    employee = await Employee.findById(attendance.employee).select('employeeType user');
    if (!employee) return res.status(404).json({ error: { message: 'Employee not found' } });
    const corrected = calculateAttendance({ employeeType: employee.employeeType, status: attendance.correctionRequest.requestedStatus, checkIn: attendance.correctionRequest.requestedCheckIn, checkOut: attendance.correctionRequest.requestedCheckOut });
    Object.assign(attendance, { ...corrected, checkIn: attendance.correctionRequest.requestedCheckIn || undefined, checkOut: attendance.correctionRequest.requestedCheckOut || undefined, isRegularized: true, regularizationReason: attendance.correctionRequest.reason, markedBy: req.user._id });
  }
  attendance.correctionRequest.status = decision;
  attendance.correctionRequest.decidedAt = new Date();
  attendance.correctionRequest.decidedBy = req.user._id;
  await attendance.save();
  await auditEvent(req, { action: `hr.attendance.correction.${decision}`, entity: 'attendance', entityId: attendance._id, after: { status: attendance.status } });
  employee ||= await Employee.findById(attendance.employee).select('user');
  await notifyEmployeeRequestDecision(req.user, employee?.user, { title: `Attendance correction ${decision}`, body: `Your attendance correction request was ${decision}.`, type: `hr.attendance.correction.${decision}`, link: '/hr/my-attendance' });
  return res.json({ data: attendance });
}

export async function listHolidays(req, res) {
  return res.json({ data: await Holiday.find().sort({ date: 1 }) });
}

export async function createHoliday(req, res) {
  const date = dateAtMidnight(req.body?.date);
  const name = String(req.body?.name || '').trim();
  const type = req.body?.type;
  if (!date || !name || !['government', 'festival', 'private'].includes(type)) return res.status(400).json({ error: { message: 'Holiday date, name, and type are required' } });
  const holiday = await Holiday.create({ date, name, type });
  await auditEvent(req, { action: 'hr.holiday.create', entity: 'holiday', entityId: holiday._id, after: { date, name } });
  return res.status(201).json({ data: holiday });
}

export async function updateHoliday(req, res) {
  const date = dateAtMidnight(req.body?.date);
  const name = String(req.body?.name || '').trim();
  const type = req.body?.type;
  if (!date || !name || !['government', 'festival', 'private'].includes(type)) return res.status(400).json({ error: { message: 'Holiday date, name, and type are required' } });
  const holiday = await Holiday.findByIdAndUpdate(req.params.id, { date, name, type }, { new: true, runValidators: true });
  if (!holiday) return res.status(404).json({ error: { message: 'Holiday not found' } });
  await auditEvent(req, { action: 'hr.holiday.update', entity: 'holiday', entityId: holiday._id, after: { date, name } });
  return res.json({ data: holiday });
}

export async function deleteHoliday(req, res) {
  const holiday = await Holiday.findByIdAndDelete(req.params.id);
  if (!holiday) return res.status(404).json({ error: { message: 'Holiday not found' } });
  await auditEvent(req, { action: 'hr.holiday.delete', entity: 'holiday', entityId: holiday._id, before: { date: holiday.date, name: holiday.name } });
  return res.json({ data: { id: String(holiday._id) } });
}
