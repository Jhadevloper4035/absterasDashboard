import { Queue, Worker } from 'bullmq';
import { Notification } from '../modules/notifications/models/notification.model.js';
import { User } from '../models/user.model.js';
import { env } from '../config/env.js';
import { isEmailConfigured, sendNotificationEmail } from './email.service.js';

const QUEUE_NAME = 'email-delivery';
let queue;
let queueForTest;

function connection() {
  if (!env.redis.url) return null;
  const url = new URL(env.redis.url);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    db: Number(url.pathname.slice(1) || 0),
    tls: url.protocol === 'rediss:' ? {} : undefined,
    maxRetriesPerRequest: null,
  };
}

function serializeAttachments(attachments = []) {
  return attachments.map((attachment) => ({
    filename: attachment.filename,
    contentType: attachment.contentType,
    content: Buffer.isBuffer(attachment.content) ? attachment.content.toString('base64') : attachment.content,
    encoding: Buffer.isBuffer(attachment.content) ? 'base64' : attachment.encoding,
  }));
}

function restoreAttachments(attachments = []) {
  return attachments.map((attachment) => ({
    ...attachment,
    content: attachment.encoding === 'base64' ? Buffer.from(attachment.content, 'base64') : attachment.content,
  }));
}

export function setEmailQueueForTest(handler) {
  queueForTest = handler;
  queue = undefined;
}

export async function queueEmailDelivery({ notificationId, attachments } = {}) {
  if (!notificationId || !isEmailConfigured()) return { skipped: true };
  const data = { notificationId: String(notificationId), attachments: serializeAttachments(attachments) };
  if (queueForTest) return queueForTest(data);
  const redis = connection();
  if (!redis) return { skipped: true };
  queue ||= new Queue(QUEUE_NAME, { connection: redis });
  return queue.add('send', data, { jobId: `email:${data.notificationId}`, attempts: 3, backoff: { type: 'exponential', delay: 1000 }, removeOnComplete: 1000, removeOnFail: 5000 });
}

export async function deliverEmailJob({ notificationId, attachments } = {}) {
  const notification = await Notification.findById(notificationId).lean();
  if (!notification || notification.channel !== 'in-app') return { skipped: true };
  const user = await User.findOne({ _id: notification.user, status: 'active' }).select('name email').lean();
  if (!user?.email || !isEmailConfigured()) return { skipped: true };

  const idempotencyKey = `${notification._id}:email`;
  const delivery = await Notification.findOneAndUpdate(
    { idempotencyKey, channel: 'email' },
    { $setOnInsert: { user: notification.user, channel: 'email', title: notification.title, body: notification.body, status: 'pending', idempotencyKey, metadata: notification.metadata } },
    { upsert: true, new: true },
  );
  if (delivery.status === 'sent') return { skipped: true };

  try {
    await sendNotificationEmail({ to: user.email, title: notification.title, body: notification.body, metadata: { ...notification.metadata, recipientName: user.name || user.email, assigneeName: user.name || user.email }, attachments: restoreAttachments(attachments) });
    await Notification.updateOne({ _id: delivery._id }, { $set: { status: 'sent' } });
    return { sent: true };
  } catch (error) {
    await Notification.updateOne({ _id: delivery._id }, { $set: { status: 'failed', 'metadata.error': error.message || 'Email send failed' } });
    throw error;
  }
}

export function startEmailWorker() {
  const redis = connection();
  if (!redis) throw new Error('REDIS_URL is required for the email worker');
  return new Worker(QUEUE_NAME, (job) => deliverEmailJob(job.data), { connection: redis, concurrency: 5 });
}
