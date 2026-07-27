import { User } from '../models/user.model.js';
import { hashPassword } from '../services/password.service.js';

function stripPassword(body) {
  const { password, passwordHash, ...user } = body;
  return user;
}

export async function createUser(req, res) {
  if (!req.body.password) {
    return res.status(400).json({ error: { message: 'Password is required' } });
  }

  const user = await User.create({
    ...stripPassword(req.body),
    passwordHash: await hashPassword(req.body.password),
  });

  res.status(201).json({ data: user });
}

export async function listUsers(req, res) {
  const users = await User.find().sort({ createdAt: -1 }).limit(50);
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
