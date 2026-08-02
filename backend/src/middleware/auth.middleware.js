import { timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';
import { User } from '../models/user.model.js';
import { isAccessTokenBlocked } from '../services/auth-session.service.js';
import { verifyAccessToken } from '../services/token.service.js';

function authError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export async function authenticate(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const claims = token ? verifyAccessToken(token) : null;

  if (!claims || await isAccessTokenBlocked(claims)) {
    return next(authError(401, 'Authentication required'));
  }

  const user = await User.findById(claims.sub);

  if (!user || user.status !== 'active') {
    return next(authError(401, 'Authentication required'));
  }

  req.user = user;
  return next();
}

export function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(authError(403, 'Forbidden'));
    }

    return next();
  };
}

function setupTokenMatches(value) {
  if (!env.setupToken) return false;
  const given = Buffer.from(String(value || ''));
  const expected = Buffer.from(env.setupToken);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function allowFirstSuperadminOrUserManager(req, res, next) {
  if (await User.exists()) {
    return authenticate(req, res, (error) => {
      if (error) return next(error);
      return authorizeRoles('superadmin', 'admin')(req, res, next);
    });
  }

  if (req.body?.role !== 'superadmin') {
    return next(authError(403, 'First user must be superadmin'));
  }

  if (env.isProduction && !setupTokenMatches(req.get('x-setup-token') || req.body?.setupToken)) {
    return next(authError(403, 'Valid setup token is required'));
  }

  return next();
}
