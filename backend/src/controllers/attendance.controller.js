import { Attendance, ATTENDANCE_STATUSES } from '../models/attendance.model.js';
import { Employee } from '../models/employee.model.js';
import { Holiday } from '../models/holiday.model.js';
import { LeaveRequest } from '../models/leave-request.model.js';
import { auditEvent } from '../services/audit.service.js';
import { calculateAttendance } from '../services/attendance.service.js';

const dateAtMidnight = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
};

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

export async function markAttendance(req, res) {
  const date = dateAtMidnight(req.body?.date);
  const records = req.body?.records;
  if (!date || !Array.isArray(records) || !records.length || records.length > 500) return res.status(400).json({ error: { message: 'Date and 1–500 attendance records are required' } });
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
