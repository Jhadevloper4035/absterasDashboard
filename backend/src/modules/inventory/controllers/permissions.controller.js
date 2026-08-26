import mongoose from 'mongoose';
import { INVENTORY_ACCESS_LEVELS, INVENTORY_MODULES, InventoryPermission } from '../models/permission.model.js';
import { User } from '../../../models/user.model.js';
import { auditEvent } from '../../../services/audit.service.js';

const invalid = (res, id) => !mongoose.isObjectIdOrHexString(id) && (res.status(400).json({ error: { message: 'Invalid user id' } }), true);
const output = (records) => { const map = new Map(records.map((record) => [record.module, record.access])); return INVENTORY_MODULES.map((module) => ({ module, access: map.get(module) || 'none' })); };
export async function getInventoryPermissions(req, res) {
  if (invalid(res, req.params.userId)) return;
  if (!await User.exists({ _id: req.params.userId })) return res.status(404).json({ error: { message: 'User not found' } });
  return res.json({ data: output(await InventoryPermission.find({ user: req.params.userId }).lean()) });
}
export async function getMyInventoryAccess(req, res) { return res.json({ data: output(await InventoryPermission.find({ user: req.user._id }).lean()) }); }
export async function updateInventoryPermissions(req, res) {
  if (invalid(res, req.params.userId)) return;
  if (!await User.exists({ _id: req.params.userId })) return res.status(404).json({ error: { message: 'User not found' } });
  if (!Array.isArray(req.body?.permissions)) return res.status(400).json({ error: { message: 'Permissions must be an array' } });
  const requested = new Map();
  for (const item of req.body.permissions) if (!INVENTORY_MODULES.includes(item?.module) || !INVENTORY_ACCESS_LEVELS.includes(item?.access) || requested.has(item.module)) return res.status(400).json({ error: { message: 'Invalid permissions' } }); else requested.set(item.module, item.access);
  const permissions = INVENTORY_MODULES.map((module) => ({ module, access: requested.get(module) || 'none' }));
  await Promise.all(permissions.map(({ module, access }) => InventoryPermission.findOneAndUpdate({ user: req.params.userId, module }, { access, grantedBy: req.user._id }, { upsert: true, runValidators: true })));
  await auditEvent(req, { action: 'inventory.permission.update', entity: 'inventory_permission', entityId: req.params.userId, after: { permissions } });
  return res.json({ data: permissions });
}
