import { timingSafeEqual } from 'node:crypto';
import { env } from '../../../config/env.js';
import { User } from '../../../models/user.model.js';
import { HrPermission } from '../../hr/models/permission.model.js';
import { InventoryPermission } from '../../inventory/models/permission.model.js';
import { APP_ACCESS_LEVELS, APP_MODULES } from '../../../config/app-modules.js';
import { isAccessTokenBlocked } from '../services/auth-session.service.js';
import { verifyAccessToken } from '../services/token.service.js';

function authError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export function userRoles(user) {
  const profileRole = ['superadmin', 'admin', 'employee'].includes(user?.workProfile) ? user.workProfile : null;
  return [...new Set([user?.role, ...(user?.additionalRoles || []), ...(user?.accessTypes || []), profileRole].filter(Boolean))];
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
    if (!req.user || !userRoles(req.user).some((role) => roles.includes(role))) {
      return next(authError(403, 'Forbidden'));
    }

    return next();
  };
}

export const appAccessLevel = (user, module) => {
  if (userRoles(user).some((role) => role === 'superadmin' || role === 'admin')) return 2;
  const access = (user.modulePermissions || []).find((permission) => permission.module === module)?.access || 'none';
  return { none: 0, view: 1, manage: 2 }[access] || 0;
};

export const hasDesignerReviewAccess = (user) => user?.workProfile === 'director' && (user.modulePermissions || []).some((permission) => permission.module === 'designer' && permission.access !== 'none');

export function authorizeDesignerDirector(req, res, next) {
  if (!hasDesignerReviewAccess(req.user)) return next(authError(403, 'Director Designer access is required'));
  return next();
}

export function authorizeAppModule(module, minAccess = 'view') {
  const required = { none: 0, view: 1, manage: 2 }[minAccess];
  if (!APP_MODULES.includes(module) || !APP_ACCESS_LEVELS.includes(minAccess)) throw new Error('Invalid application module permission');

  return (req, res, next) => {
    if (!req.user) return next(authError(401, 'Authentication required'));
    if (module === 'hr' && minAccess === 'view' && req.user.workProfile === 'employee') return next();
    if (appAccessLevel(req.user, module) < required) return next(authError(403, 'Forbidden'));
    return next();
  };
}

export function authorizeHrModule(module, minAccess = 'view') {
  const required = minAccess === 'manage' ? 2 : 1;
  const levels = { none: 0, view: 1, manage: 2 };
  return async (req, res, next) => {
    if (!req.user) return next(authError(401, 'Authentication required'));
    if (req.user.workProfile === 'employee' && minAccess === 'view' && ['attendance', 'expenses', 'leave', 'payroll', 'employee-overview', 'employees'].includes(module)) {
      req.hrAccess = 'view';
      return next();
    }
    if (appAccessLevel(req.user, 'hr') < (req.method === 'GET' ? required : 2)) return next(authError(403, 'Forbidden'));
    const accessTypes = userRoles(req.user);
    if (appAccessLevel(req.user, 'hr') === 2) {
      req.hrAccess = 'manage';
      return next();
    }
    if (['attendance', 'expenses', 'leave', 'payroll', 'employee-overview', 'employees'].includes(module) && minAccess === 'view' && (req.user.workProfile === 'employee' || (!req.user.workProfile && accessTypes.includes('employee')))) {
      req.hrAccess = 'view';
      return next();
    }
    const permission = await HrPermission.findOne({ user: req.user._id, module }).select('access').lean();
    if (!permission || levels[permission.access] < required) return next(authError(403, 'Forbidden'));
    req.hrAccess = permission.access;
    return next();
  };
}

export function authorizeInventoryModule(module, minAccess = 'view') {
  const required = minAccess === 'manage' ? 2 : 1;
  const levels = { none: 0, view: 1, manage: 2 };
  return async (req, res, next) => {
    if (!req.user) return next(authError(401, 'Authentication required'));
    const accessLevel = appAccessLevel(req.user, 'inventory');
    if (accessLevel < (req.method === 'GET' ? required : 2)) return next(authError(403, 'Forbidden'));
    if (accessLevel >= required) {
      req.inventoryAccess = accessLevel === 2 ? 'manage' : 'view';
      return next();
    }
    const permission = await InventoryPermission.findOne({ user: req.user._id, module }).select('access').lean();
    if (!permission || levels[permission.access] < required) return next(authError(403, 'Forbidden'));
    req.inventoryAccess = permission.access;
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
    if (!String(req.get('authorization') || '').startsWith('Bearer ')) {
      return next(authError(409, 'Initial setup is already complete. Sign in as an admin to create more users.'));
    }

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
