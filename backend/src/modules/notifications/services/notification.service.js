import mongoose from 'mongoose';
import { Notification } from '../models/notification.model.js';
import { isEmailConfigured } from '../../../services/email.service.js';
import { queueEmailDelivery } from '../../../services/email-queue.service.js';
import { invalidateCache } from '../../../services/redis-cache.service.js';

export async function notifyUsers(userIds, { title, body, metadata, attachments } = {}) {
  const actorId = metadata?.fromUserId ? String(metadata.fromUserId) : '';
  const ids = [...new Set((userIds || []).map((id) => id?._id || id).filter(Boolean).map(String))].filter((id) => id !== actorId);
  if (!ids.length || mongoose.connection.readyState !== 1) return;

  const notifications = await Notification.insertMany(
    ids.map((user) => ({
      user,
      channel: 'in-app',
      title,
      body,
      status: 'sent',
      metadata,
    })),
    { ordered: false },
  );

  await invalidateCache('unread-notifications');

  if (!isEmailConfigured()) return;
  await Promise.allSettled(notifications.map((notification) => queueEmailDelivery({ notificationId: notification._id, attachments })));
}
