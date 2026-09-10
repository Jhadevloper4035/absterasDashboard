import { AuthSession } from '../modules/auth/models/auth-session.model.js';
import { BlockedToken } from '../modules/auth/models/blocked-token.model.js';
import { User, WORK_PROFILES } from '../models/user.model.js';
import { env } from '../config/env.js';
import { Employee } from '../modules/hr/models/employee.model.js';
import { SalaryStructure } from '../modules/hr/models/salary-structure.model.js';
import { Attendance } from '../modules/hr/models/attendance.model.js';
import { Advance } from '../modules/hr/models/advance.model.js';
import { ExpenseClaim } from '../modules/hr/models/expense-claim.model.js';
import { LeaveBalance } from '../modules/hr/models/leave-balance.model.js';
import { LeaveRequest } from '../modules/hr/models/leave-request.model.js';
import { PaidLeaveAllocation } from '../modules/hr/models/paid-leave-allocation.model.js';
import { HrPermission } from '../modules/hr/models/permission.model.js';
import { InventoryPermission } from '../modules/inventory/models/permission.model.js';
import { LoginHistory } from '../modules/auth/models/login-history.model.js';
import { Lead } from '../modules/leads/models/lead.model.js';
import { Notification } from '../modules/notifications/models/notification.model.js';
import { Task } from '../modules/tasks/models/task.model.js';
import { Todo } from '../modules/tasks/models/todo.model.js';
import mongoose from 'mongoose';
import { cleanIpAddress } from '../helpers/request-ip.js';
import { auditEvent } from '../services/audit.service.js';
import { revokeActiveUserSessions, revokeAllActiveSessions } from '../modules/auth/services/auth-session.service.js';
import { clearFailedLoginAttempts } from '../modules/auth/services/login-attempt.service.js';
import { invalidateCache } from '../services/redis-cache.service.js';
import { hashPassword, passwordPolicyError } from '../modules/auth/services/password.service.js';
import { userRoles } from '../modules/auth/middleware/auth.middleware.js';
import { APP_ACCESS_LEVELS, APP_MODULES } from '../config/app-modules.js';

const SUPERADMIN_ROLE = 'superadmin';
const USER_UPDATE_FIELDS = ['name', 'email', 'phone', 'whatsappNumber', 'workProfile', 'modulePermissions', 'status', 'timezone', 'notificationPreferences'];


function cleanAdditionalRoles(roles, primaryRole) {
  if (roles === undefined) return undefined;
  return [...new Set((Array.isArray(roles) ? roles : []).filter((role) => ASSIGNABLE_ACCESS_TYPES.includes(role) && role !== primaryRole))];
}

function cleanAccessTypes(types) {
  if (types === undefined) return undefined;
  return [...new Set((Array.isArray(types) ? types : []).map((type) => String(type).trim().toLowerCase()).filter((type) => /^[a-z][a-z0-9-]{1,39}$/.test(type)))].slice(0, 20);
}

function cleanWorkProfile(profile) {
  return WORK_PROFILES.includes(profile) ? profile : null;
}

function cleanModulePermissions(permissions) {
  if (!Array.isArray(permissions)) return null;
  const accessByModule = new Map();
  for (const permission of permissions) {
    if (!APP_MODULES.includes(permission?.module) || !APP_ACCESS_LEVELS.includes(permission?.access) || accessByModule.has(permission.module)) return null;
    accessByModule.set(permission.module, permission.access);
  }
  return APP_MODULES.map((module) => ({ module, access: accessByModule.get(module) || 'none' }));
}

function cleanTerritories(territories) {
  return (Array.isArray(territories) ? territories : String(territories || '').split(','))
    .map((territory) => String(territory).trim())
    .filter(Boolean)
    .slice(0, 50);
}



function stripPassword(body) {
  const { password, passwordHash, ...user } = body;
  return user;
}

function allowedUserUpdate(body) {
  const update = USER_UPDATE_FIELDS.reduce((fields, field) => {
    if (body[field] !== undefined) fields[field] = body[field];
    return fields;
  }, {});
  if (body.territories !== undefined) update.territories = cleanTerritories(body.territories);
  if (update.workProfile !== undefined) update.workProfile = cleanWorkProfile(update.workProfile);
  if (update.modulePermissions !== undefined) update.modulePermissions = cleanModulePermissions(update.modulePermissions);
  return update;
}

function employmentDetails(body) {
  const employment = body?.employment;
  if (!employment) return null;
  if (!['office', 'site'].includes(employment.employeeType) || !employment.department || !employment.designation || !employment.joiningDate) return undefined;
  const monthlySalary = Number(employment.monthlySalary);
  if (!Number.isFinite(monthlySalary) || monthlySalary <= 0) return undefined;
  return { employeeType: employment.employeeType, department: employment.department, designation: employment.designation, manager: employment.manager || undefined, joiningDate: employment.joiningDate, dateOfBirth: employment.dateOfBirth || undefined, monthlySalary };
}

async function roleLimitError(role, currentUserId) {
  if (role !== SUPERADMIN_ROLE) return '';

  const filter = { role };
  if (currentUserId) filter._id = { $ne: currentUserId };

  return (await User.exists(filter)) ? `Only one ${role} is allowed` : '';
}

async function superadminProfileLimitError(currentUserId) {
  const filter = { $or: [{ role: SUPERADMIN_ROLE }, { additionalRoles: SUPERADMIN_ROLE }, { accessTypes: SUPERADMIN_ROLE }, { workProfile: SUPERADMIN_ROLE }] };
  if (currentUserId) filter._id = { $ne: currentUserId };
  return (await User.exists(filter)) ? 'Only one superadmin is allowed' : '';
}

function adminCanManage(actor, targetUser) {
  return userRoles(actor).includes(SUPERADMIN_ROLE) || !userRoles(targetUser).includes(SUPERADMIN_ROLE);
}

function canManageUsers(user) {
  return userRoles(user).some((role) => role === SUPERADMIN_ROLE || role === 'admin');
}

function hasAdminAccess(user) {
  return user?.role === 'admin' || user?.additionalRoles?.includes('admin') || user?.accessTypes?.includes('admin') || user?.workProfile === 'admin';
}

async function adminAccessLimitError(user, currentUserId) {
  if (!hasAdminAccess(user)) return '';
  const filter = { $or: [{ role: 'admin' }, { additionalRoles: 'admin' }, { accessTypes: 'admin' }, { workProfile: 'admin' }] };
  if (currentUserId) filter._id = { $ne: currentUserId };
  return (await User.exists(filter)) ? 'Only one admin is allowed' : '';
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function purgeDevelopmentUserData(userId) {
  const employees = await Employee.find({ user: userId }).select('_id').lean();
  const employeeIds = employees.map((employee) => employee._id);
  await Promise.all([
    AuthSession.deleteMany({ user: userId }), BlockedToken.deleteMany({ user: userId }), LoginHistory.deleteMany({ user: userId }), HrPermission.deleteMany({ $or: [{ user: userId }, { grantedBy: userId }] }), InventoryPermission.deleteMany({ $or: [{ user: userId }, { grantedBy: userId }] }), Notification.deleteMany({ user: userId }),
    Lead.deleteMany({ $or: [{ owner: userId }, { createdBy: userId }] }), Task.deleteMany({ $or: [{ assignee: userId }, { createdBy: userId }, { completedBy: userId }] }), Todo.deleteMany({ $or: [{ assignedTo: userId }, { createdBy: userId }, { completedBy: userId }] }),
    ...(employeeIds.length ? [Attendance.deleteMany({ employee: { $in: employeeIds } }), Advance.deleteMany({ employee: { $in: employeeIds } }), ExpenseClaim.deleteMany({ employee: { $in: employeeIds } }), LeaveBalance.deleteMany({ employee: { $in: employeeIds } }), LeaveRequest.deleteMany({ employee: { $in: employeeIds } }), PaidLeaveAllocation.deleteMany({ employee: { $in: employeeIds } }), SalaryStructure.deleteMany({ employee: { $in: employeeIds } }), Employee.deleteMany({ _id: { $in: employeeIds } })] : []),
  ]);
}

export async function createUser(req, res) {
  if (!req.body.password) {
    return res.status(400).json({ error: { message: 'Password is required' } });
  }

  const passwordError = passwordPolicyError(req.body.password);
  if (passwordError) {
    return res.status(400).json({ error: { message: passwordError } });
  }

  if (!String(req.body.phone || '').trim()) {
    return res.status(400).json({ error: { message: 'Mobile number is required' } });
  }

  if (req.user && (req.body.role === SUPERADMIN_ROLE || req.body.accessTypes?.includes(SUPERADMIN_ROLE))) {
    return res.status(403).json({ error: { message: 'Only initial setup can create the Superadmin account' } });
  }

  const requestedAccessTypes = cleanAccessTypes(req.body.accessTypes) || [];
  const employment = employmentDetails(req.body);
  const employeeProfile = req.body.workProfile === 'employee' || (req.body.workProfile === undefined && requestedAccessTypes.includes('employee'));
  if (employment === undefined) return res.status(400).json({ error: { message: 'Employee type, department, designation, joining date and monthly salary are required' } });
  if (employment && !employeeProfile) return res.status(400).json({ error: { message: 'Select the Employee work profile before adding employment details' } });
  if (employeeProfile && !employment) return res.status(400).json({ error: { message: 'Employee type, department, designation, joining date and monthly salary are required' } });

  const userFields = allowedUserUpdate(stripPassword(req.body));
  if (userFields.modulePermissions === null) return res.status(400).json({ error: { message: 'Invalid module permissions' } });
  if (userFields.workProfile === null) return res.status(400).json({ error: { message: 'Invalid work profile' } });
  if (userFields.workProfile === SUPERADMIN_ROLE && (!req.user || !userRoles(req.user).includes(SUPERADMIN_ROLE))) return res.status(403).json({ error: { message: 'Only Superadmin can assign the Superadmin profile' } });
  if (userFields.workProfile === SUPERADMIN_ROLE) {
    const limitError = await superadminProfileLimitError();
    if (limitError) return res.status(400).json({ error: { message: limitError } });
  }
  if (userFields.workProfile === 'admin') {
    const limitError = await adminAccessLimitError(userFields);
    if (limitError) return res.status(400).json({ error: { message: limitError } });
  }
  if (!req.user && req.body.role === SUPERADMIN_ROLE) userFields.role = SUPERADMIN_ROLE;
  const user = await User.create({
    ...userFields,
    passwordHash: await hashPassword(req.body.password),
  });

  if (employment) {
    try {
      const { monthlySalary, ...employeeDetails } = employment;
      const employee = await Employee.create({ user: user._id, ...employeeDetails });
      if (monthlySalary !== undefined) await SalaryStructure.create({ employee: employee._id, ctc: monthlySalary, basic: monthlySalary, hra: 0, effectiveFrom: employee.joiningDate });
    } catch (error) {
      await Employee.deleteOne({ user: user._id });
      await User.deleteOne({ _id: user._id });
      throw error;
    }
  }

  await auditEvent(req, { action: 'user.create', entity: 'user', entityId: user._id, after: { role: user.role, status: user.status } });
  res.status(201).json({ data: user });
}

export async function listUsers(req, res) {
  const page = Math.max(Number(req.query.page || 1), 1);
  const limit = Math.min(Math.max(Number(req.query.limit || 25), 1), 100);
  const roleFilter = req.query.role ? [req.query.role] : [];
  const filter = roleFilter.length ? { $or: [{ role: { $in: roleFilter } }, { additionalRoles: { $in: roleFilter } }] } : {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.q) {
    const search = { $regex: escapeRegex(req.query.q), $options: 'i' };
    filter.$and = [{ $or: [{ name: search }, { email: search }, { phone: search }] }];
    if (roleFilter.length) {
      filter.$and.unshift({ $or: [{ role: { $in: roleFilter } }, { additionalRoles: { $in: roleFilter } }] });
      delete filter.$or;
    }
  }

  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    User.countDocuments(filter),
  ]);
  res.json({ data: users, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } });
}

export async function requestPasswordReset(req, res) {
  const passwordError = passwordPolicyError(req.body?.password);
  if (passwordError) return res.status(400).json({ error: { message: passwordError } });
  if (req.user.passwordResetRequestedAt) return res.status(409).json({ error: { message: 'A password reset request is already pending' } });

  const requestedAt = new Date();
  await User.findByIdAndUpdate(req.user._id, {
    $set: { passwordResetPasswordHash: await hashPassword(req.body.password), passwordResetRequestedAt: requestedAt },
    $push: { passwordResetHistory: { requestedAt, status: 'pending' } },
  });
  await auditEvent(req, { action: 'user.password_reset_requested', entity: 'user', entityId: req.user._id });
  return res.status(201).json({ data: { ok: true, requestedAt } });
}

export async function listMyPasswordResetHistory(req, res) {
  const user = await User.findById(req.user._id).select('passwordResetHistory').lean();
  return res.json({ data: (user?.passwordResetHistory || []).sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt)) });
}

export async function listPasswordResetRequests(req, res) {
  const users = await User.find({ passwordResetRequestedAt: { $exists: true } })
    .select('name email role workProfile passwordResetRequestedAt')
    .sort({ passwordResetRequestedAt: -1 })
    .lean();
  return res.json({ data: users });
}

export async function approvePasswordResetRequest(req, res) {
  const requestedUser = await User.findById(req.params.id).select('+passwordResetPasswordHash');
  if (!requestedUser) return res.status(404).json({ error: { message: 'User not found' } });
  if (!requestedUser.passwordResetPasswordHash) return res.status(400).json({ error: { message: 'No pending password reset request' } });
  if (!adminCanManage(req.user, requestedUser)) return res.status(403).json({ error: { message: 'Only Superadmin can approve this request' } });

  await User.findByIdAndUpdate(requestedUser._id, {
    $set: { passwordHash: requestedUser.passwordResetPasswordHash, failedLoginAttempts: 0, loginLockedAt: null, 'passwordResetHistory.$[request].approvedAt': new Date(), 'passwordResetHistory.$[request].status': 'approved' },
    $unset: { passwordResetPasswordHash: 1, passwordResetRequestedAt: 1 },
  }, {
    arrayFilters: [{ 'request.status': 'pending' }],
  });
  await clearFailedLoginAttempts(requestedUser._id);
  await revokeActiveUserSessions(requestedUser._id);
  await auditEvent(req, { action: 'user.password_reset_approved', entity: 'user', entityId: requestedUser._id });
  return res.json({ data: { ok: true } });
}

export async function listLoginHistory(req, res) {
  const filter = {};
  const sessionFilter = { revokedAt: null, expiresAt: { $gt: new Date() } };
  const cleanupAt = new Date();
  const page = Math.max(Number(req.query.page || 1), 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 50);

  const userId = canManageUsers(req.user) ? req.query.userId : req.user._id;
  if (userId) {
    const selectedUser = canManageUsers(req.user) && req.query.userId
      ? await User.findById(req.query.userId).select('role')
      : req.user;
    if (!selectedUser) return res.status(404).json({ error: { message: 'User not found' } });
    filter.user = selectedUser._id;
    sessionFilter.user = selectedUser._id;
  }

  const activeSessions = await AuthSession.find(sessionFilter).sort({ createdAt: -1 }).limit(50).populate('user', 'name email role status').lean();
  const activeSessionUsers = new Set();
  const staleSessionIds = [];
  const currentSessions = [];
  for (const session of activeSessions) {
    const userId = String(session.user?._id || session.user);
    if (!userId) continue;
    if (activeSessionUsers.has(userId)) staleSessionIds.push(session._id);
    else {
      activeSessionUsers.add(userId);
      currentSessions.push(session);
    }
  }
  if (staleSessionIds.length) {
    await AuthSession.updateMany({ _id: { $in: staleSessionIds } }, { $set: { revokedAt: cleanupAt } });
  }

  const historyLimit = page === 1 ? limit : limit + currentSessions.length;
  const historySkip = Math.max((page - 1) * limit - currentSessions.length, 0);
  const history = await LoginHistory.find(filter).sort({ loggedInAt: -1 }).skip(historySkip).limit(historyLimit).populate('user', 'name email role status').lean();
  const totalHistory = await LoginHistory.countDocuments(filter);
  const newestOpenByUser = new Map();
  const staleLoggedOutHistoryIds = [];
  const staleNewLoginHistoryIds = [];
  for (const item of history.filter((row) => !row.logoutAt)) {
    const userId = String(item.user?._id || item.user);
    if (!activeSessionUsers.has(userId)) {
      item.logoutAt = cleanupAt;
      item.logoutReason = 'logout';
      staleLoggedOutHistoryIds.push(item._id);
      continue;
    }
    const newest = newestOpenByUser.get(userId);
    if (newest) {
      item.logoutAt = cleanupAt;
      item.logoutReason = 'new_login';
      staleNewLoginHistoryIds.push(item._id);
    } else {
      newestOpenByUser.set(userId, item);
    }
  }
  if (staleLoggedOutHistoryIds.length) {
    await LoginHistory.updateMany({ _id: { $in: staleLoggedOutHistoryIds } }, { $set: { logoutAt: cleanupAt, logoutReason: 'logout' } });
  }
  if (staleNewLoginHistoryIds.length) {
    await LoginHistory.updateMany({ _id: { $in: staleNewLoginHistoryIds } }, { $set: { logoutAt: cleanupAt, logoutReason: 'new_login' } });
  }

  const openHistoryUsers = new Set(history.filter((item) => !item.logoutAt).map((item) => String(item.user?._id || item.user)));
  const activeRows = currentSessions
    .filter((session) => session.user && !openHistoryUsers.has(String(session.user._id)))
    .map((session) => ({
      _id: `active-${session._id}`,
      user: session.user,
      email: session.user.email,
      role: session.user.role,
      ipAddress: cleanIpAddress(session.ipAddress),
      userAgent: session.userAgent,
      loggedInAt: session.createdAt,
    }));

  const data = [...history, ...activeRows]
    .map((item) => ({ ...item, ipAddress: cleanIpAddress(item.ipAddress) }))
    .sort((a, b) => new Date(b.loggedInAt) - new Date(a.loggedInAt))
    .slice(0, limit);
  const total = totalHistory + (page === 1 ? activeRows.length : 0);
  res.json({ data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } });
}

export async function logoutUser(req, res) {
  const user = await User.findById(req.params.id).select('role status');
  if (!user) {
    return res.status(404).json({ error: { message: 'User not found' } });
  }

  await revokeActiveUserSessions(user._id);
  await LoginHistory.updateMany({ user: user._id, logoutAt: null }, { $set: { logoutAt: new Date(), logoutReason: 'logout' } });
  await auditEvent(req, { action: 'user.logout', entity: 'user', entityId: user._id, before: { status: user.status, role: user.role } });
  return res.json({ data: { ok: true } });
}

export async function logoutAllUsers(req, res) {
  const revokedSessions = await revokeAllActiveSessions();
  await LoginHistory.updateMany({ logoutAt: null }, { $set: { logoutAt: new Date(), logoutReason: 'logout' } });
  await auditEvent(req, { action: 'user.logout_all', entity: 'user', entityId: 'all', details: { revokedSessions } });
  return res.json({ data: { ok: true, revokedSessions } });
}

export async function getUser(req, res) {
  const user = await User.findById(req.params.id);

  if (!user) {
    return res.status(404).json({ error: { message: 'User not found' } });
  }

  if (!adminCanManage(req.user, user)) {
    return res.status(403).json({ error: { message: 'Admins can manage team users only' } });
  }

  return res.json({ data: user });
}

export async function updateUser(req, res) {
  const update = allowedUserUpdate(stripPassword(req.body));
  if (update.modulePermissions === null) return res.status(400).json({ error: { message: 'Invalid module permissions' } });
  if (update.workProfile === null) return res.status(400).json({ error: { message: 'Invalid work profile' } });
  const currentUser = await User.findById(req.params.id);

  if (!currentUser) {
    return res.status(404).json({ error: { message: 'User not found' } });
  }

  const actorIsSuperadmin = userRoles(req.user).includes(SUPERADMIN_ROLE);
  if (!adminCanManage(req.user, currentUser) || (!actorIsSuperadmin && currentUser.role === SUPERADMIN_ROLE)) {
    return res.status(403).json({ error: { message: 'Only Superadmin can manage the Superadmin account' } });
  }
  if (update.workProfile === SUPERADMIN_ROLE && !actorIsSuperadmin) return res.status(403).json({ error: { message: 'Only Superadmin can assign the Superadmin profile' } });
  if (update.workProfile === SUPERADMIN_ROLE) {
    const limitError = await superadminProfileLimitError(currentUser._id);
    if (limitError) return res.status(400).json({ error: { message: limitError } });
  }
  if (update.workProfile === 'admin') {
    const currentUserData = typeof currentUser.toObject === 'function' ? currentUser.toObject() : currentUser;
    const limitError = await adminAccessLimitError({ ...currentUserData, ...update }, currentUser._id);
    if (limitError) return res.status(400).json({ error: { message: limitError } });
  }

  if (update.phone !== undefined && !String(update.phone).trim()) {
    return res.status(400).json({ error: { message: 'Mobile number is required' } });
  }


  if (req.body.password) {
    const passwordError = passwordPolicyError(req.body.password);
    if (passwordError) {
      return res.status(400).json({ error: { message: passwordError } });
    }
    update.passwordHash = await hashPassword(req.body.password);
  }

  if (update.status === 'active') {
    update.failedLoginAttempts = 0;
    update.loginLockedAt = null;
  }

  const securityChanged = Boolean(req.body.password) || ['status', 'workProfile', 'modulePermissions'].some((field) => update[field] !== undefined && JSON.stringify(update[field]) !== JSON.stringify(currentUser[field]));

  const user = await User.findByIdAndUpdate(req.params.id, update, {
    new: true,
    runValidators: true,
  });

  if (!user) {
    return res.status(404).json({ error: { message: 'User not found' } });
  }

  if (update.status === 'active') await clearFailedLoginAttempts(user._id);
  if (securityChanged) {
    await revokeActiveUserSessions(user._id);
    await Promise.all([invalidateCache('lead-lists'), invalidateCache('task-lists')]);
  }

  await auditEvent(req, {
    action: 'user.update',
    entity: 'user',
    entityId: user._id,
    before: { role: currentUser.role, status: currentUser.status },
    after: { role: user.role, status: user.status },
    details: { fields: Object.keys(update).filter((field) => field !== 'passwordHash') },
  });

  return res.json({ data: user });
}

export async function deleteUser(req, res) {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: { message: 'User not found' } });
  if (String(user._id) === String(req.user._id)) return res.status(400).json({ error: { message: 'You cannot delete your own account' } });
  if (!adminCanManage(req.user, user) || (!userRoles(req.user).includes(SUPERADMIN_ROLE) && hasAdminAccess(user))) return res.status(403).json({ error: { message: 'Only Superadmin can delete an Admin account' } });

  if (req.query?.hard === 'true') {
    if (env.isProduction) return res.status(403).json({ error: { message: 'Hard delete is unavailable in production' } });
    await revokeActiveUserSessions(user._id);
    if (mongoose.connection.readyState === 1) await purgeDevelopmentUserData(user._id);
    await User.deleteOne({ _id: user._id });
    await auditEvent(req, { action: 'user.hard_delete', entity: 'user', entityId: user._id, before: { role: user.role, status: user.status } });
    return res.json({ data: { id: String(user._id), hardDeleted: true } });
  }

  await User.findByIdAndUpdate(user._id, { status: 'inactive', failedLoginAttempts: 0, loginLockedAt: null }, { runValidators: true });
  await revokeActiveUserSessions(user._id);
  await auditEvent(req, { action: 'user.delete', entity: 'user', entityId: user._id, before: { role: user.role, status: user.status }, after: { status: 'inactive' } });
  return res.json({ data: { id: String(user._id) } });
}
