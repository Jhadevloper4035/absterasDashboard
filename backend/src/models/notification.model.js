import mongoose from 'mongoose';

const { ObjectId, Mixed } = mongoose.Schema.Types;

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: ObjectId,
      ref: 'User',
      required: true,
    },
    channel: {
      type: String,
      enum: ['in-app', 'push', 'whatsapp', 'sms', 'email'],
      required: true,
    },
    title: {
      type: String,
      trim: true,
    },
    body: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'sent', 'delivered', 'read', 'failed', 'cancelled'],
      default: 'pending',
    },
    idempotencyKey: {
      type: String,
      trim: true,
      index: true,
    },
    scheduledFor: Date,
    readAt: Date,
    metadata: Mixed,
  },
  { timestamps: true },
);

export const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
