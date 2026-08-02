import mongoose from 'mongoose';
import { Notification } from '../models/notification.model.js';
import { User } from '../models/user.model.js';
import { isEmailConfigured, sendNotificationEmail } from './email.service.js';

async function sendEmailNotifications(ids, { title, body, metadata }) {
  const users = await User.find({ _id: { $in: ids }, status: 'active' }).select('email');
  const results = await Promise.allSettled(
    users
      .filter((user) => user.email)
      .map(async (user) => {
        await sendNotificationEmail({ to: user.email, title, body, metadata });
        return { user: user._id, channel: 'email', title, body, status: 'sent', metadata };
      }),
  );
  const emailNotifications = results.map((result, index) => {
    if (result.status === 'fulfilled') return result.value;
    const user = users.filter((item) => item.email)[index];
    return {
      user: user._id,
      channel: 'email',
      title,
      body,
      status: 'failed',
      metadata: { ...(metadata || {}), error: result.reason?.message || 'Email send failed' },
    };
  });

  if (emailNotifications.length) {
    await Notification.insertMany(emailNotifications, { ordered: false });
  }
}

export async function notifyUsers(userIds, { title, body, metadata } = {}) {
  const actorId = metadata?.fromUserId ? String(metadata.fromUserId) : '';
  const ids = [...new Set((userIds || []).map((id) => id?._id || id).filter(Boolean).map(String))].filter((id) => id !== actorId);
  if (!ids.length || mongoose.connection.readyState !== 1) return;

  await Notification.insertMany(
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

  if (!isEmailConfigured()) return;
  setImmediate(() => {
    sendEmailNotifications(ids, { title, body, metadata }).catch(() => {});
  });
}
