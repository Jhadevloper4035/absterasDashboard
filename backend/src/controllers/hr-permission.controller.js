import mongoose from 'mongoose';
import { HR_ACCESS_LEVELS, HR_MODULES, HrPermission } from '../models/hr-permission.model.js';
import { User } from '../models/user.model.js';
import { auditEvent } from '../services/audit.service.js';
import { userRoles } from '../middleware/auth.middleware.js';

function invalidUser(res, userId) {
  if (!mongoose.isObjectIdOrHexString(userId)) {
    res.status(400).json({ error: { message: 'Invalid user id' } });
    return true;
  }
  return false;
}

export async function getHrPermissions(req, res) {
  if (invalidUser(res, req.params.userId)) return;
  if (!await User.exists({ _id: req.params.userId })) return res.status(404).json({ error: { message: 'User not found' } });

  const permissions = await HrPermission.find({ user: req.params.userId }).lean();
  const accessByModule = new Map(permissions.map((permission) => [permission.module, permission.access]));
  return res.json({ data: HR_MODULES.map((module) => ({ module, access: accessByModule.get(module) || 'none' })) });
}

export async function getMyHrAccess(req, res) {
  const accessTypes = userRoles(req.user);
  if (accessTypes.some((role) => ['superadmin', 'admin', 'hr-management'].includes(role))) return res.json({ data: HR_MODULES.map((module) => ({ module, access: 'manage' })) });
  const permissions = await HrPermission.find({ user: req.user._id }).lean();
  const accessByModule = new Map(permissions.map((permission) => [permission.module, permission.access]));
  if (accessTypes.includes('employee')) for (const module of ['expenses', 'leave']) accessByModule.set(module, accessByModule.get(module) || 'view');
  return res.json({ data: HR_MODULES.map((module) => ({ module, access: accessByModule.get(module) || 'none' })) });
}

export async function updateHrPermissions(req, res) {
  if (invalidUser(res, req.params.userId)) return;
  if (!await User.exists({ _id: req.params.userId })) return res.status(404).json({ error: { message: 'User not found' } });
  if (!Array.isArray(req.body?.permissions)) return res.status(400).json({ error: { message: 'Permissions must be an array' } });

  const requested = new Map();
  for (const permission of req.body.permissions) {
    if (!HR_MODULES.includes(permission?.module) || !HR_ACCESS_LEVELS.includes(permission?.access) || requested.has(permission.module)) {
      return res.status(400).json({ error: { message: 'Invalid permissions' } });
    }
    requested.set(permission.module, permission.access);
  }

  const permissions = HR_MODULES.map((module) => ({ module, access: requested.get(module) || 'none' }));
  await Promise.all(permissions.map(({ module, access }) => HrPermission.findOneAndUpdate(
    { user: req.params.userId, module },
    { access, grantedBy: req.user._id },
    { upsert: true, new: true, runValidators: true },
  )));
  await auditEvent(req, { action: 'hr.permission.update', entity: 'hr_permission', entityId: req.params.userId, after: { permissions } });
  return res.json({ data: permissions });
}
