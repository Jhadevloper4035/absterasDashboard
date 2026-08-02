import { AuthSession } from '../models/auth-session.model.js';
import { User } from '../models/user.model.js';
import { LoginHistory } from '../models/login-history.model.js';
import { cleanIpAddress } from '../helpers/request-ip.js';
import { auditEvent } from '../services/audit.service.js';
import { revokeActiveUserSessions } from '../services/auth-session.service.js';
import { hashPassword, passwordPolicyError } from '../services/password.service.js';

const SINGLE_USER_ROLES = ['superadmin', 'admin'];
const TEAM_USER_ROLES = ['sales', 'operations', 'accounts', 'designers'];
const USER_UPDATE_FIELDS = ['name', 'email', 'phone', 'whatsappNumber', 'role', 'status', 'timezone', 'notificationPreferences'];

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
  return update;
}

async function roleLimitError(role, currentUserId) {
  if (!SINGLE_USER_ROLES.includes(role)) return '';

  const filter = { role };
  if (currentUserId) filter._id = { $ne: currentUserId };

  return (await User.exists(filter)) ? `Only one ${role} is allowed` : '';
}

function adminCanManage(actor, targetUser) {
  return actor?.role === 'admin' ? TEAM_USER_ROLES.includes(targetUser.role) : true;
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

  if (req.user?.role === 'admin' && !TEAM_USER_ROLES.includes(req.body.role)) {
    return res.status(403).json({ error: { message: 'Admins can create team users only' } });
  }

  const roleError = await roleLimitError(req.body.role);
  if (roleError) {
    return res.status(400).json({ error: { message: roleError } });
  }

  const user = await User.create({
    ...allowedUserUpdate(stripPassword(req.body)),
    passwordHash: await hashPassword(req.body.password),
  });

  await auditEvent(req, { action: 'user.create', entity: 'user', entityId: user._id, after: { role: user.role, status: user.status } });
  res.status(201).json({ data: user });
}

export async function listUsers(req, res) {
  const filter = req.user?.role === 'admin' ? { role: { $in: TEAM_USER_ROLES } } : {};
  const users = await User.find(filter).sort({ createdAt: -1 }).limit(50);
  res.json({ data: users });
}

export async function listLoginHistory(req, res) {
  const filter = {};
  const sessionFilter = { revokedAt: null, expiresAt: { $gt: new Date() } };
  const cleanupAt = new Date();
  const limit = Math.min(Number(req.query.limit) || 100, 200);

  if (req.query.userId) {
    const selectedUser = await User.findById(req.query.userId).select('role');
    if (!selectedUser) return res.status(404).json({ error: { message: 'User not found' } });
    filter.user = selectedUser._id;
    sessionFilter.user = selectedUser._id;
  }

  const activeSessions = await AuthSession.find(sessionFilter).sort({ createdAt: -1 }).limit(limit).populate('user', 'name email role status').lean();
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

  const history = await LoginHistory.find(filter).sort({ loggedInAt: -1 }).limit(limit).populate('user', 'name email role status').lean();
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
  res.json({ data });
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

  if (!adminCanManage(req.user, currentUser) || (req.user?.role === 'admin' && update.role && !TEAM_USER_ROLES.includes(update.role))) {
    return res.status(403).json({ error: { message: 'Admins can manage team users only' } });
  }

  if (update.phone !== undefined && !String(update.phone).trim()) {
    return res.status(400).json({ error: { message: 'Mobile number is required' } });
  }

  if (update.role && update.role !== currentUser.role) {
    const roleError = await roleLimitError(update.role, currentUser._id);
    if (roleError) {
      return res.status(400).json({ error: { message: roleError } });
    }

    if (SINGLE_USER_ROLES.includes(currentUser.role) && update.role !== currentUser.role) {
      return res.status(400).json({ error: { message: `One ${currentUser.role} is required` } });
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
