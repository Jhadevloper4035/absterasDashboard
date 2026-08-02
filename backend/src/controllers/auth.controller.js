import { User } from '../models/user.model.js';
import { LoginHistory } from '../models/login-history.model.js';
import { requestIp } from '../helpers/request-ip.js';
import { verifyPassword } from '../services/password.service.js';
import { createSession, hasActiveUserSession, rotateSession, revokeSession } from '../services/auth-session.service.js';
import { verifyAccessToken } from '../services/token.service.js';

const REFRESH_COOKIE = 'sales_crm_refresh';

function cookieOptions(expiresAt) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: reqIsSecure(),
    expires: expiresAt,
    path: '/api/auth',
  };
}

function reqIsSecure() {
  return process.env.NODE_ENV === 'production';
}

function readCookie(req, name) {
  return String(req.headers.cookie || '')
    .split(';')
    .map((part) => part.trim().split('='))
    .find(([key]) => key === name)?.[1];
}

function setRefreshCookie(res, refreshToken, expiresAt) {
  res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions(expiresAt));
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE, { ...cookieOptions(new Date(0)), expires: undefined });
}

function refreshTokenFrom(req) {
  return readCookie(req, REFRESH_COOKIE) || req.body?.refreshToken;
}

function authResponse(session) {
  return {
    token: session.accessToken,
    accessToken: session.accessToken,
    accessTokenExpiresAt: session.accessTokenExpiresAt,
    user: session.user,
  };
}

function logAuth(event, req, details = {}) {
  console.info(JSON.stringify({ event, environment: process.env.NODE_ENV || 'development', ip: requestIp(req), ...details }));
}

async function recordLogin(user, req, loggedInAt) {
  await LoginHistory.updateMany(
    { user: user._id, logoutAt: null },
    { $set: { logoutAt: loggedInAt, logoutReason: 'new_login' } },
  ).catch((error) => logAuth('auth.login_history.close_previous_failed', req, { userId: String(user._id), message: error.message }));

  await LoginHistory.create({
    user: user._id,
    email: user.email,
    role: user.role,
    ipAddress: requestIp(req),
    userAgent: String(req.get('user-agent') || '').slice(0, 300),
    loggedInAt,
  }).catch((error) => logAuth('auth.login_history.failed', req, { userId: String(user._id), message: error.message }));
}

async function recordLogout(userId, req) {
  if (!userId) return;

  await LoginHistory.findOneAndUpdate(
    { user: userId, logoutAt: null },
    { $set: { logoutAt: new Date(), logoutReason: 'logout' } },
    { sort: { loggedInAt: -1 } },
  ).catch((error) => logAuth('auth.logout_history.failed', req, { userId: String(userId), message: error.message }));
}

export async function login(req, res) {
  const { email, password } = req.body;
  const normalizedEmail = String(email || '').toLowerCase().trim();

  if (!email || !password) {
    logAuth('auth.login.missing_credentials', req);
    return res.status(400).json({ error: { message: 'Email and password are required' } });
  }

  const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash');

  if (!user || user.status !== 'active' || !(await verifyPassword(password, user.passwordHash))) {
    logAuth('auth.login.failed', req, { email: normalizedEmail });
    return res.status(401).json({ error: { message: 'Invalid email or password' } });
  }

  if (await hasActiveUserSession(user._id)) {
    logAuth('auth.login.blocked_active_session', req, { userId: String(user._id), email: normalizedEmail });
    return res.status(409).json({ error: { message: 'User is already logged in. Please logout from the active device or ask admin to end the session.' } });
  }

  const lastLoginAt = new Date();
  await User.updateOne({ _id: user._id }, { $set: { lastLoginAt } });
  user.lastLoginAt = lastLoginAt;

  const session = await createSession(user, req);
  await recordLogin(user, req, lastLoginAt);
  setRefreshCookie(res, session.refreshToken, session.refreshTokenExpiresAt);
  logAuth('auth.login.succeeded', req, { userId: String(user._id), email: normalizedEmail });

  return res.json({ data: authResponse({ ...session, user }) });
}

export function me(req, res) {
  res.json({ data: req.user });
}

export async function refresh(req, res) {
  const session = await rotateSession(refreshTokenFrom(req), req);

  if (!session) {
    clearRefreshCookie(res);
    logAuth('auth.refresh.failed', req);
    return res.status(401).json({ error: { message: 'Authentication required' } });
  }

  setRefreshCookie(res, session.refreshToken, session.refreshTokenExpiresAt);
  logAuth('auth.refresh.succeeded', req, { userId: String(session.user._id) });
  return res.json({ data: authResponse(session) });
}

export async function logout(req, res) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const claims = token ? verifyAccessToken(token) : null;
  const revokedSession = await revokeSession(refreshTokenFrom(req), claims);
  await recordLogout(claims?.sub || revokedSession?.user, req);
  clearRefreshCookie(res);
  logAuth('auth.logout', req);
  return res.json({ data: { ok: true } });
}
