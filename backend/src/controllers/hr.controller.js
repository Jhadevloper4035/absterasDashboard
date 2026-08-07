import { Department } from '../models/department.model.js';
import { Designation } from '../models/designation.model.js';
import { Employee } from '../models/employee.model.js';
import { User } from '../models/user.model.js';
import { SalaryStructure } from '../models/salary-structure.model.js';
import { auditEvent } from '../services/audit.service.js';
import { signAttachmentUrls, trustedAttachment } from '../services/upload.service.js';
import { revokeActiveUserSessions } from '../services/auth-session.service.js';

const EMPLOYEE_FIELDS = ['employeeType', 'department', 'designation', 'manager', 'joiningDate', 'status', 'lastWorkingDate', 'emergencyContact'];
const isAdmin = (user) => ['superadmin', 'admin'].includes(user.role);
const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const invalidId = (value) => !/^[a-f\d]{24}$/i.test(value || '');

function organizationController(Model, entity, referenceField) {
  return {
    list: async (req, res) => res.json({ data: await Model.find().sort({ name: 1 }) }),
    create: async (req, res) => {
      const name = String(req.body?.name || '').trim();
      if (!name) return res.status(400).json({ error: { message: 'Name is required' } });
      const record = await Model.create({ name, description: String(req.body.description || '').trim(), ...(entity === 'designation' && req.body.department ? { department: req.body.department } : {}) });
      await auditEvent(req, { action: `hr.${entity}.create`, entity, entityId: record._id, after: { name: record.name } });
      return res.status(201).json({ data: record });
    },
    update: async (req, res) => {
      const name = String(req.body?.name || '').trim();
      if (!name) return res.status(400).json({ error: { message: 'Name is required' } });
      const record = await Model.findByIdAndUpdate(req.params.id, { name, description: String(req.body.description || '').trim(), ...(entity === 'designation' && req.body.department ? { department: req.body.department } : {}) }, { new: true, runValidators: true });
      if (!record) return res.status(404).json({ error: { message: `${entity} not found` } });
      await auditEvent(req, { action: `hr.${entity}.update`, entity, entityId: record._id, after: { name: record.name } });
      return res.json({ data: record });
    },
    remove: async (req, res) => {
      if (referenceField && await Employee.exists({ [referenceField]: req.params.id })) {
        return res.status(409).json({ error: { message: `Cannot delete a ${entity} used by an employee` } });
      }
      const record = await Model.findByIdAndDelete(req.params.id);
      if (!record) return res.status(404).json({ error: { message: `${entity} not found` } });
      await auditEvent(req, { action: `hr.${entity}.delete`, entity, entityId: record._id, before: { name: record.name } });
      return res.json({ data: { id: String(record._id) } });
    },
  };
}

const departments = organizationController(Department, 'department', 'department');
const designations = organizationController(Designation, 'designation', 'designation');
export const listDepartments = departments.list;
export const createDepartment = departments.create;
export const updateDepartment = departments.update;
export const deleteDepartment = departments.remove;
export const listDesignations = designations.list;
export const createDesignation = designations.create;
export const updateDesignation = designations.update;
export const deleteDesignation = designations.remove;

function employeePatch(body) {
  const patch = EMPLOYEE_FIELDS.reduce((result, field) => (body[field] === undefined ? result : { ...result, [field]: body[field] }), {});
  if (body.documents !== undefined) {
    patch.documents = (Array.isArray(body.documents) ? body.documents : []).map((document) => {
      const attachment = trustedAttachment(document);
      return attachment && String(document.type || '').trim() ? { ...attachment, type: String(document.type).trim(), expiresAt: document.expiresAt || undefined, uploadedAt: new Date() } : null;
    }).filter(Boolean).slice(0, 20);
  }
  if (body.photo !== undefined) {
    const photo = trustedAttachment(body.photo);
    if (photo && photo.contentType?.startsWith('image/')) patch.photo = { ...photo, type: 'Employee photo' };
  }
  return patch;
}

async function employeeData(employee) {
  const data = employee.toObject ? employee.toObject() : employee;
  const [photo] = await signAttachmentUrls(data.photo ? [data.photo] : []);
  return { ...data, photo, documents: await signAttachmentUrls(data.documents || []) };
}

export async function listEmployees(req, res) {
  const page = Math.max(Number(req.query.page || 1), 1);
  const limit = Math.min(Math.max(Number(req.query.limit || 25), 1), 100);
  const canManage = isAdmin(req.user) || req.hrAccess === 'manage';
  const employeeUsers = canManage ? await User.find({ accessTypes: 'employee' }).select('_id') : [];
  const employeeUserIds = employeeUsers.map((user) => user._id);
  const query = canManage ? { user: { $in: employeeUserIds } } : { user: req.user._id };
  if (canManage && req.query.status) query.status = req.query.status;
  if (canManage && req.query.department) query.department = req.query.department;
  if (canManage && req.query.q) {
    const users = await User.find({ name: { $regex: escapeRegex(req.query.q), $options: 'i' } }).select('_id');
    query.user = { $in: users.map((user) => user._id).filter((id) => employeeUserIds.some((employeeId) => String(employeeId) === String(id))) };
  }
  const [employees, total] = await Promise.all([
    Employee.find(query).populate('user', 'name email phone status').populate('department', 'name').populate('designation', 'name').populate('manager', 'name email').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Employee.countDocuments(query),
  ]);
  return res.json({ data: employees, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } });
}

export async function createEmployee(req, res) {
  if (!req.body.user || invalidId(req.body.user)) return res.status(400).json({ error: { message: 'Select an existing user with Employee access' } });
  const user = await User.findById(req.body.user).select('accessTypes');
  if (!user || !user.accessTypes?.includes('employee')) return res.status(400).json({ error: { message: 'Select an existing user with Employee access' } });
  if (await Employee.exists({ user: req.body.user })) return res.status(409).json({ error: { message: 'This user already has an employee profile' } });
  const employee = await Employee.create({ user: req.body.user, ...employeePatch(req.body) });
  await auditEvent(req, { action: 'hr.employee.create', entity: 'employee', entityId: employee._id, after: { user: employee.user, status: employee.status } });
  return res.status(201).json({ data: await employeeData(await employee.populate(['user', 'department', 'designation', 'manager'])) });
}

export async function getEmployee(req, res) {
  const employee = await Employee.findById(req.params.id).populate('user', 'name email phone status').populate('department', 'name').populate('designation', 'name').populate('manager', 'name email');
  if (!employee) return res.status(404).json({ error: { message: 'Employee not found' } });
  if (!isAdmin(req.user) && req.hrAccess !== 'manage' && String(employee.user._id) !== String(req.user._id)) return res.status(403).json({ error: { message: 'Forbidden' } });
  const salary = await SalaryStructure.findOne({ employee: employee._id, effectiveFrom: { $lte: new Date() } }).sort({ effectiveFrom: -1 });
  return res.json({ data: { ...await employeeData(employee), salary } });
}

export async function updateEmployee(req, res) {
  const employee = await Employee.findById(req.params.id);
  if (!employee) return res.status(404).json({ error: { message: 'Employee not found' } });
  const patch = employeePatch(req.body);
  const wasTerminated = employee.status === 'terminated';
  Object.assign(employee, patch);
  await employee.save();
  if (patch.status === 'terminated') {
    await User.findByIdAndUpdate(employee.user, { status: 'suspended' });
    await revokeActiveUserSessions(employee.user);
  } else if (patch.status === 'active' && wasTerminated) {
    await User.findByIdAndUpdate(employee.user, { status: 'active' });
  }
  await auditEvent(req, { action: 'hr.employee.update', entity: 'employee', entityId: employee._id, after: { status: employee.status } });
  return res.json({ data: await employeeData(await employee.populate(['user', 'department', 'designation', 'manager'])) });
}

export async function deleteEmployee(req, res) {
  const employee = await Employee.findById(req.params.id);
  if (!employee) return res.status(404).json({ error: { message: 'Employee not found' } });
  await employee.deleteOne();
  await User.findByIdAndUpdate(employee.user, { status: 'suspended' });
  await revokeActiveUserSessions(employee.user);
  await auditEvent(req, { action: 'hr.employee.delete', entity: 'employee', entityId: employee._id, before: { user: employee.user } });
  return res.json({ data: { id: String(employee._id) } });
}
