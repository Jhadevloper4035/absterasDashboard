import { User } from '../models/user.model.js';
import { hashPassword } from '../services/password.service.js';

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

  res.status(201).json({ data: user });
}

export async function listUsers(req, res) {
  const filter = req.user?.role === 'admin' ? { role: { $in: TEAM_USER_ROLES } } : {};
  const users = await User.find(filter).sort({ createdAt: -1 }).limit(50);
  res.json({ data: users });
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
    update.passwordHash = await hashPassword(req.body.password);
  }

  const user = await User.findByIdAndUpdate(req.params.id, update, {
    new: true,
    runValidators: true,
  });

  if (!user) {
    return res.status(404).json({ error: { message: 'User not found' } });
  }

  return res.json({ data: user });
}
