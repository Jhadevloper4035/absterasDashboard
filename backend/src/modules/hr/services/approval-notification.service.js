import mongoose from 'mongoose';
import { User } from '../../../models/user.model.js';
import { dashboardUrl } from '../../../services/email-templates/base.js';
import { notifyUsers } from '../../notifications/services/notification.service.js';

const HR_APPROVER_QUERY = {
  status: 'active',
  $or: [
    { role: { $in: ['superadmin', 'admin'] } },
    { additionalRoles: { $in: ['superadmin', 'admin'] } },
    { accessTypes: { $in: ['superadmin', 'admin', 'hr-management'] } },
    { workProfile: { $in: ['superadmin', 'admin'] } },
    { modulePermissions: { $elemMatch: { module: 'hr', access: 'manage' } } },
  ],
};

export async function notifyHrApprovers(actor, { title, body, link } = {}) {
  if (mongoose.connection.readyState !== 1) return;
  const approvers = await User.find(HR_APPROVER_QUERY).select('_id');
  const path = String(link || '').startsWith('/') ? link : '/hr';
  return notifyUsers(approvers, {
    title,
    body,
    metadata: {
      type: 'hr.request.pending',
      fromUserId: actor?._id,
      fromName: actor?.name || actor?.email || 'Employee',
      fromRole: actor?.role || 'employee',
      link: path,
      actionUrl: `${dashboardUrl()}${path}`,
    },
  });
}

export async function notifyEmployeeRequestDecision(actor, employeeUserId, { title, body, type, link } = {}) {
  const path = String(link || '').startsWith('/') ? link : '/hr';
  return notifyUsers([employeeUserId], {
    title,
    body,
    metadata: {
      type: type || 'hr.request.decision',
      fromUserId: actor?._id,
      fromName: actor?.name || actor?.email || 'HR',
      fromRole: actor?.role || 'hr-management',
      link: path,
      actionUrl: `${dashboardUrl()}${path}`,
    },
  });
}
