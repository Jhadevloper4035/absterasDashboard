import { User } from '../models/user.model.js';
import { verifyPassword } from '../services/password.service.js';
import { createAccessToken } from '../services/token.service.js';

export async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: { message: 'Email and password are required' } });
  }

  const user = await User.findOne({ email: String(email).toLowerCase().trim() }).select('+passwordHash');

  if (!user || user.status !== 'active' || !(await verifyPassword(password, user.passwordHash))) {
    return res.status(401).json({ error: { message: 'Invalid email or password' } });
  }

  user.lastLoginAt = new Date();
  await user.save();

  return res.json({ data: { token: createAccessToken(user), user } });
}

export function me(req, res) {
  res.json({ data: req.user });
}
