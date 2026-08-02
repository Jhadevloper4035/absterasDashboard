import mongoose from 'mongoose';
import { AuditLog } from '../models/audit-log.model.js';

export async function auditEvent(req, { action, entity, entityId, before, after, details } = {}) {
  if (!action || !entity || !entityId || mongoose.connection.readyState !== 1) return;

  try {
    await AuditLog.create({
      actor: req.user?._id,
      actorRole: req.user?.role,
      action,
      entity,
      entityId: String(entityId),
      ipAddress: req.ip,
      userAgent: String(req.get?.('user-agent') || '').slice(0, 300),
      before,
      after,
      details,
    });
  } catch (error) {
    console.error('Audit log failed', error);
  }
}
