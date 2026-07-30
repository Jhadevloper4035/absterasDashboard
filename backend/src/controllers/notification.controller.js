import { Notification } from '../models/notification.model.js';

export async function listUnreadNotifications(req, res) {
  const notifications = await Notification.find({
    user: req.user._id,
    channel: 'in-app',
    status: { $ne: 'read' },
  })
    .sort({ createdAt: 1 })
    .limit(20)
    .lean();

  return res.json({ data: notifications });
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
