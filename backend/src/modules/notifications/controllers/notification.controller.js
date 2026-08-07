import { Notification } from '../models/notification.model.js';
import { Lead } from '../../leads/models/lead.model.js';
import { Task } from '../../tasks/models/task.model.js';

function senderFrom(user) {
  if (!user) return null;
  return {
    fromName: user.name || user.email || 'User',
    fromRole: user.role || 'user',
  };
}

function noteSender(notification, task) {
  const notificationTime = new Date(notification.createdAt).getTime();
  return [...(task.notes || [])]
    .filter((note) => new Date(note.createdAt).getTime() <= notificationTime + 5000)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]?.createdBy;
}

function inferredSender(notification, task) {
  if (!task) return null;
  if (notification.metadata?.type === 'task.note') return noteSender(notification, task) || task.createdBy;
  if (notification.metadata?.type === 'task.updated') return task.completedBy || task.createdBy;
  return task.createdBy;
}

function latestBefore(notification, items, dateField, userField) {
  const notificationTime = new Date(notification.createdAt).getTime();
  return [...(items || [])]
    .filter((item) => new Date(item[dateField]).getTime() <= notificationTime + 5000)
    .sort((a, b) => new Date(b[dateField]) - new Date(a[dateField]))[0]?.[userField];
}

function inferredLeadSender(notification, lead) {
  if (!lead) return null;
  const type = notification.metadata?.type;
  if (type === 'lead.assigned') return latestBefore(notification, lead.assignmentHistory, 'assignedAt', 'actor');
  if (type === 'lead.note') return latestBefore(notification, lead.notes, 'createdAt', 'createdBy');
  if (type?.startsWith('lead.meeting')) return latestBefore(notification, lead.meetingHistory, 'scheduledAt', 'scheduledBy');
  return null;
}

async function withSenderMetadata(notifications) {
  const taskIds = [
    ...new Set(
      notifications
        .filter((notification) => notification.metadata?.taskId && !notification.metadata?.fromName)
        .map((notification) => String(notification.metadata.taskId)),
    ),
  ];
  const leadIds = [
    ...new Set(
      notifications
        .filter((notification) => notification.metadata?.leadId && !notification.metadata?.fromName)
        .map((notification) => String(notification.metadata.leadId)),
    ),
  ];
  if (!taskIds.length && !leadIds.length) return notifications;

  const [tasks, leads] = await Promise.all([
    taskIds.length
      ? Task.find({ _id: { $in: taskIds } })
        .populate('createdBy', 'name email role')
        .populate('completedBy', 'name email role')
        .populate('notes.createdBy', 'name email role')
        .lean()
      : [],
    leadIds.length
      ? Lead.find({ _id: { $in: leadIds } })
        .populate('assignmentHistory.actor', 'name email role')
        .populate('notes.createdBy', 'name email role')
        .populate('meetingHistory.scheduledBy', 'name email role')
        .lean()
      : [],
  ]);
  const taskById = new Map(tasks.map((task) => [String(task._id), task]));
  const leadById = new Map(leads.map((lead) => [String(lead._id), lead]));

  return notifications.map((notification) => {
    if (notification.metadata?.fromName) return notification;
    const user = notification.metadata?.taskId
      ? inferredSender(notification, taskById.get(String(notification.metadata.taskId)))
      : inferredLeadSender(notification, leadById.get(String(notification.metadata?.leadId)));
    const sender = senderFrom(user);
    return sender ? { ...notification, metadata: { ...notification.metadata, ...sender } } : notification;
  });
}

export async function listUnreadNotifications(req, res) {
  const notifications = await Notification.find({
    user: req.user._id,
    channel: 'in-app',
    status: { $ne: 'read' },
  })
    .sort({ createdAt: 1 })
    .limit(20)
    .lean();

  return res.json({ data: await withSenderMetadata(notifications) });
}

export async function markNotificationsRead(req, res) {
  const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
  if (!ids.length) return res.json({ data: { modifiedCount: 0 } });

  const result = await Notification.updateMany(
    { _id: { $in: ids }, user: req.user._id },
    { status: 'read', readAt: new Date() },
  );

  return res.json({ data: { modifiedCount: result.modifiedCount } });
}
