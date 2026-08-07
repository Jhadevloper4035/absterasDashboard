import { AuthSession } from '../modules/auth/models/auth-session.model.js';
import { User } from '../models/user.model.js';
import { Employee } from '../modules/hr/models/employee.model.js';
import { SalaryStructure } from '../modules/hr/models/salary-structure.model.js';
import { LoginHistory } from '../modules/auth/models/login-history.model.js';
import { cleanIpAddress } from '../helpers/request-ip.js';
import { auditEvent } from '../services/audit.service.js';
import { revokeActiveUserSessions, revokeAllActiveSessions } from '../modules/auth/services/auth-session.service.js';
import { hashPassword, passwordPolicyError } from '../modules/auth/services/password.service.js';
import { userRoles } from '../modules/auth/middleware/auth.middleware.js';

const SUPERADMIN_ROLE = 'superadmin';
const TEAM_USER_ROLES = ['sales', 'operations', 'accounts', 'designers'];
const ASSIGNABLE_ACCESS_TYPES = ['admin', ...TEAM_USER_ROLES];
const SYSTEM_ACCESS_TYPES = [SUPERADMIN_ROLE, ...ASSIGNABLE_ACCESS_TYPES];
const USER_UPDATE_FIELDS = ['name', 'email', 'phone', 'whatsappNumber', 'role', 'additionalRoles', 'accessTypes', 'status', 'timezone', 'notificationPreferences'];

function cleanAdditionalRoles(roles, primaryRole) {
  if (roles === undefined) return undefined;
  return [...new Set((Array.isArray(roles) ? roles : []).filter((role) => ASSIGNABLE_ACCESS_TYPES.includes(role) && role !== primaryRole))];
}

function cleanAccessTypes(types) {
  if (types === undefined) return undefined;
  return [...new Set((Array.isArray(types) ? types : []).map((type) => String(type).trim().toLowerCase()).filter((type) => /^[a-z][a-z0-9-]{1,39}$/.test(type)))].slice(0, 20);
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
  if (update.additionalRoles !== undefined) update.additionalRoles = cleanAdditionalRoles(update.additionalRoles, update.role || body.role);
  if (update.accessTypes !== undefined) update.accessTypes = cleanAccessTypes(update.accessTypes);
  return update;
}

function employmentDetails(body) {
  const employment = body?.employment;
  if (!employment) return null;
  if (!['office', 'site'].includes(employment.employeeType) || !employment.department || !employment.designation || !employment.joiningDate) return undefined;
  const monthlySalary = employment.monthlySalary === undefined || employment.monthlySalary === '' ? undefined : Number(employment.monthlySalary);
  if (monthlySalary !== undefined && (!Number.isFinite(monthlySalary) || monthlySalary < 0)) return undefined;
  return { employeeType: employment.employeeType, department: employment.department, designation: employment.designation, manager: employment.manager || undefined, joiningDate: employment.joiningDate, monthlySalary };
}

async function roleLimitError(role, currentUserId) {
  if (role !== SUPERADMIN_ROLE) return '';

  const filter = { role };
  if (currentUserId) filter._id = { $ne: currentUserId };

  return (await User.exists(filter)) ? `Only one ${role} is allowed` : '';
}

function adminCanManage(actor, targetUser) {
  return userRoles(actor).includes(SUPERADMIN_ROLE) || !userRoles(targetUser).includes(SUPERADMIN_ROLE);
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

  const roleError = await roleLimitError(req.body.role);
  if (roleError) {
    return res.status(400).json({ error: { message: roleError } });
  }

  const requestedAccessTypes = cleanAccessTypes(req.body.accessTypes) || [];
  const employment = employmentDetails(req.body);
  if (employment === undefined) return res.status(400).json({ error: { message: 'Employee type, department, designation and joining date are required' } });
  if (employment && !requestedAccessTypes.includes('employee')) return res.status(400).json({ error: { message: 'Select the Employee access type before adding employment details' } });
  if (requestedAccessTypes.includes('employee') && !employment) return res.status(400).json({ error: { message: 'Employee type, department, designation and joining date are required' } });

  const userFields = allowedUserUpdate(stripPassword(req.body));
  userFields.additionalRoles = cleanAdditionalRoles(userFields.additionalRoles, userFields.role);
  userFields.accessTypes = requestedAccessTypes.filter((type) => !SYSTEM_ACCESS_TYPES.includes(type));
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

export async function listLoginHistory(req, res) {
  const filter = {};
  const sessionFilter = { revokedAt: null, expiresAt: { $gt: new Date() } };
  const cleanupAt = new Date();
  const page = Math.max(Number(req.query.page || 1), 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 50);

  if (req.query.userId) {
    const selectedUser = await User.findById(req.query.userId).select('role');
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
  const currentUser = await User.findById(req.params.id);

  if (!currentUser) {
    return res.status(404).json({ error: { message: 'User not found' } });
  }

  const actorIsSuperadmin = userRoles(req.user).includes(SUPERADMIN_ROLE);
  if (!adminCanManage(req.user, currentUser) || (!actorIsSuperadmin && (currentUser.role === SUPERADMIN_ROLE || update.role === SUPERADMIN_ROLE))) {
    return res.status(403).json({ error: { message: 'Only Superadmin can manage the Superadmin account' } });
  }

  if (update.role === 'admin' && currentUser.role !== 'admin') {
    return res.status(400).json({ error: { message: 'Assign Admin through access types' } });
  }

  if (update.additionalRoles !== undefined) {
    update.additionalRoles = cleanAdditionalRoles(update.additionalRoles, update.role || currentUser.role);
  }

  if (update.accessTypes !== undefined) {
    const accessTypes = cleanAccessTypes(update.accessTypes);
    if (accessTypes.includes(SUPERADMIN_ROLE)) return res.status(403).json({ error: { message: 'Superadmin can only be created during initial setup' } });
    const businessTypes = accessTypes.filter((type) => TEAM_USER_ROLES.includes(type));
    const assignableTypes = accessTypes.filter((type) => ASSIGNABLE_ACCESS_TYPES.includes(type));
    if (TEAM_USER_ROLES.includes(currentUser.role) && !businessTypes.length) {
      return res.status(400).json({ error: { message: 'Select at least one business access type' } });
    }
    if (businessTypes.length) {
      if (TEAM_USER_ROLES.includes(currentUser.role)) {
        update.role = businessTypes[0];
        update.additionalRoles = assignableTypes.filter((type) => type !== update.role);
      } else {
        update.additionalRoles = assignableTypes.filter((type) => type !== currentUser.role);
      }
    }
    update.accessTypes = accessTypes.filter((type) => !SYSTEM_ACCESS_TYPES.includes(type));
  }

  if (update.phone !== undefined && !String(update.phone).trim()) {
    return res.status(400).json({ error: { message: 'Mobile number is required' } });
  }

  if (update.role && update.role !== currentUser.role) {
    const roleError = await roleLimitError(update.role, currentUser._id);
    if (roleError) {
      return res.status(400).json({ error: { message: roleError } });
    }

    if (currentUser.role === SUPERADMIN_ROLE && update.role !== currentUser.role) {
      return res.status(400).json({ error: { message: 'Superadmin role cannot be changed' } });
    }
  }

  if (req.body.password) {
    const passwordError = passwordPolicyError(req.body.password);
    if (passwordError) {
      return res.status(400).json({ error: { message: passwordError } });
    }
    update.passwordHash = await hashPassword(req.body.password);
  }

  const user = await User.findByIdAndUpdate(req.params.id, update, {
    new: true,
    runValidators: true,
  });

  if (!user) {
    return res.status(404).json({ error: { message: 'User not found' } });
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
