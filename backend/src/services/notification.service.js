import mongoose from 'mongoose';
import { Notification } from '../models/notification.model.js';

export async function notifyUsers(userIds, { title, body, metadata } = {}) {
  const ids = [...new Set((userIds || []).map((id) => id?._id || id).filter(Boolean).map(String))];
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
}
