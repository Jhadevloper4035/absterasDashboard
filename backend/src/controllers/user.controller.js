import { User } from '../models/user.model.js';
import { hashPassword } from '../services/password.service.js';

const SINGLE_USER_ROLES = ['superadmin', 'admin'];

function stripPassword(body) {
  const { password, passwordHash, ...user } = body;
  return user;
}

async function roleLimitError(role, currentUserId) {
  if (!SINGLE_USER_ROLES.includes(role)) return '';

  const filter = { role };
  if (currentUserId) filter._id = { $ne: currentUserId };

  return (await User.exists(filter)) ? `Only one ${role} is allowed` : '';
}

export async function createUser(req, res) {
  if (!req.body.password) {
    return res.status(400).json({ error: { message: 'Password is required' } });
  }

  const roleError = await roleLimitError(req.body.role);
  if (roleError) {
    return res.status(400).json({ error: { message: roleError } });
  }

  const user = await User.create({
    ...stripPassword(req.body),
    passwordHash: await hashPassword(req.body.password),
  });

  res.status(201).json({ data: user });
}

export async function listUsers(req, res) {
  const filter = req.user?.role === 'admin' ? { role: 'sales', status: 'active' } : {};
  const users = await User.find(filter).sort({ createdAt: -1 }).limit(50);
  res.json({ data: users });
}

export async function getUser(req, res) {
  const user = await User.findById(req.params.id);

  if (!user) {
    return res.status(404).json({ error: { message: 'User not found' } });
  }

  return res.json({ data: user });
}

export async function updateUser(req, res) {
  const update = stripPassword(req.body);
  const currentUser = await User.findById(req.params.id);

  if (!currentUser) {
    return res.status(404).json({ error: { message: 'User not found' } });
  }

  if (update.role) {
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
