import mongoose from 'mongoose';
import { LEAD_STATUSES } from './lead.model.js';

const { ObjectId, Mixed } = mongoose.Schema.Types;

const attachmentRefSchema = new mongoose.Schema(
  {
    attachment: {
      type: ObjectId,
      ref: 'Attachment',
    },
    url: {
      type: String,
      trim: true,
    },
    name: {
      type: String,
      trim: true,
    },
  },
  { _id: false },
);

const permissionSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true },
);

const roleSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    permissions: [
      {
        type: ObjectId,
        ref: 'Permission',
      },
    ],
    isSystem: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

const userRoleSchema = new mongoose.Schema(
  {
    user: {
      type: ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: ObjectId,
      ref: 'Role',
      required: true,
    },
    assignedBy: {
      type: ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true },
);

const teamSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    manager: {
      type: ObjectId,
      ref: 'User',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

const teamMemberSchema = new mongoose.Schema(
  {
    team: {
      type: ObjectId,
      ref: 'Team',
      required: true,
    },
    user: {
      type: ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      enum: ['member', 'manager'],
      default: 'member',
    },
  },
  { timestamps: true },
);

const territorySchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    parent: {
      type: ObjectId,
      ref: 'Territory',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

const leadSourceSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['manual', 'csv', 'api', 'webhook', 'integration'],
      default: 'manual',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

const campaignSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    source: {
      type: ObjectId,
      ref: 'LeadSource',
    },
    code: {
      type: String,
      trim: true,
      index: true,
    },
  },
  { timestamps: true },
);

const leadAssignmentSchema = new mongoose.Schema(
  {
    lead: {
      type: ObjectId,
      ref: 'Lead',
      required: true,
    },
    previousOwner: {
      type: ObjectId,
      ref: 'User',
    },
    newOwner: {
      type: ObjectId,
      ref: 'User',
    },
    reason: {
      type: String,
      trim: true,
    },
    rule: {
      type: String,
      trim: true,
    },
    actor: {
      type: ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true },
);

const leadStageSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      enum: LEAD_STATUSES,
      required: true,
      unique: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    order: {
      type: Number,
      required: true,
    },
    isClosed: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

const leadStatusHistorySchema = new mongoose.Schema(
  {
    lead: {
      type: ObjectId,
      ref: 'Lead',
      required: true,
    },
    from: {
      type: String,
      enum: LEAD_STATUSES,
    },
    to: {
      type: String,
      enum: LEAD_STATUSES,
      required: true,
    },
    reason: {
      type: String,
      trim: true,
    },
    actor: {
      type: ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true },
);

const activitySchema = new mongoose.Schema(
  {
    lead: {
      type: ObjectId,
      ref: 'Lead',
      required: true,
    },
    type: {
      type: String,
      enum: ['call', 'note', 'email', 'whatsapp', 'meeting', 'mom', 'attachment', 'status', 'assignment'],
      required: true,
    },
    summary: {
      type: String,
      trim: true,
    },
    actor: {
      type: ObjectId,
      ref: 'User',
    },
    happenedAt: {
      type: Date,
      default: Date.now,
    },
    attachments: [attachmentRefSchema],
    metadata: Mixed,
  },
  { timestamps: true },
);

const followUpSchema = new mongoose.Schema(
  {
    lead: {
      type: ObjectId,
      ref: 'Lead',
      required: true,
    },
    assignedUser: {
      type: ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: ['call', 'email', 'whatsapp', 'meeting', 'task'],
      default: 'task',
    },
    dueAt: {
      type: Date,
      required: true,
    },
    timezone: {
      type: String,
      default: 'UTC',
    },
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal',
    },
    notes: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'skipped', 'cancelled'],
      default: 'pending',
    },
    completedAt: Date,
    completedBy: {
      type: ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true },
);

const meetingSchema = new mongoose.Schema(
  {
    lead: {
      type: ObjectId,
      ref: 'Lead',
      required: true,
    },
    owner: {
      type: ObjectId,
      ref: 'User',
      required: true,
    },
    attendees: [
      {
        type: ObjectId,
        ref: 'User',
      },
    ],
    title: {
      type: String,
      required: true,
      trim: true,
    },
    agenda: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      enum: ['phone', 'online', 'in-person'],
      required: true,
    },
    address: {
      type: String,
      trim: true,
    },
    meetingUrl: {
      type: String,
      trim: true,
    },
    startAt: {
      type: Date,
      required: true,
    },
    timezone: {
      type: String,
      required: true,
    },
    durationMinutes: {
      type: Number,
      min: 1,
      required: true,
    },
    endAt: Date,
    status: {
      type: String,
      enum: ['SCHEDULED', 'CONFIRMED', 'COMPLETED', 'RESCHEDULED', 'CANCELLED', 'CLIENT_NO_SHOW', 'SALESPERSON_NO_SHOW'],
      default: 'SCHEDULED',
    },
    outcome: {
      type: String,
      trim: true,
    },
    reminder: {
      enabled: {
        type: Boolean,
        default: true,
      },
      minutesBefore: {
        type: Number,
        default: 60,
        min: 0,
      },
    },
  },
  { timestamps: true },
);

meetingSchema.pre('validate', function setMeetingEndAt() {
  if (this.startAt && this.durationMinutes && !this.endAt) {
    this.endAt = new Date(this.startAt.getTime() + this.durationMinutes * 60 * 1000);
  }
});

const meetingHistorySchema = new mongoose.Schema(
  {
    meeting: {
      type: ObjectId,
      ref: 'Meeting',
      required: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
    },
    fromStatus: String,
    toStatus: String,
    actor: {
      type: ObjectId,
      ref: 'User',
    },
    reason: String,
    metadata: Mixed,
  },
  { timestamps: true },
);

const momActionItemSchema = new mongoose.Schema(
  {
    mom: {
      type: ObjectId,
      ref: 'MeetingMom',
    },
    owner: {
      type: ObjectId,
      ref: 'User',
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
    dueAt: Date,
    status: {
      type: String,
      enum: ['pending', 'completed', 'cancelled'],
      default: 'pending',
    },
  },
  { timestamps: true },
);

const meetingMomSchema = new mongoose.Schema(
  {
    meeting: {
      type: ObjectId,
      ref: 'Meeting',
      required: true,
    },
    lead: {
      type: ObjectId,
      ref: 'Lead',
      required: true,
    },
    createdBy: {
      type: ObjectId,
      ref: 'User',
      required: true,
    },
    discussionSummary: String,
    clientRequirements: String,
    questionsAndObjections: String,
    decisions: String,
    outcome: String,
    productsDiscussed: [String],
    budget: Number,
    expectedClosureDate: Date,
    nextFollowUpAt: Date,
    recommendedLeadStatus: {
      type: String,
      enum: LEAD_STATUSES,
    },
    attachments: [attachmentRefSchema],
    internalNotes: String,
    version: {
      type: Number,
      default: 1,
      min: 1,
    },
  },
  { timestamps: true },
);

const momVersionSchema = new mongoose.Schema(
  {
    mom: {
      type: ObjectId,
      ref: 'MeetingMom',
      required: true,
    },
    version: {
      type: Number,
      required: true,
      min: 1,
    },
    snapshot: {
      type: Mixed,
      required: true,
    },
    editedBy: {
      type: ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true },
);

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

const notificationDeliverySchema = new mongoose.Schema(
  {
    notification: {
      type: ObjectId,
      ref: 'Notification',
      required: true,
    },
    provider: String,
    providerMessageId: String,
    status: {
      type: String,
      enum: ['attempted', 'sent', 'delivered', 'read', 'failed'],
      required: true,
    },
    error: String,
  },
  { timestamps: true },
);

const notificationPreferenceSchema = new mongoose.Schema(
  {
    user: {
      type: ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    inApp: {
      type: Boolean,
      default: true,
    },
    whatsapp: {
      type: Boolean,
      default: false,
    },
    morningSummary: {
      enabled: {
        type: Boolean,
        default: false,
      },
      time: {
        type: String,
        default: '08:00',
        match: /^([01]\d|2[0-3]):[0-5]\d$/,
      },
      timezone: {
        type: String,
        default: 'UTC',
      },
    },
  },
  { timestamps: true },
);

const customerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    company: String,
    owner: {
      type: ObjectId,
      ref: 'User',
    },
    sourceLead: {
      type: ObjectId,
      ref: 'Lead',
    },
  },
  { timestamps: true },
);

const contactSchema = new mongoose.Schema(
  {
    customer: {
      type: ObjectId,
      ref: 'Customer',
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true },
);

const dealSchema = new mongoose.Schema(
  {
    customer: {
      type: ObjectId,
      ref: 'Customer',
      required: true,
    },
    lead: {
      type: ObjectId,
      ref: 'Lead',
    },
    owner: {
      type: ObjectId,
      ref: 'User',
    },
    value: Number,
    productOrService: String,
    closeDate: Date,
    status: {
      type: String,
      enum: ['open', 'won', 'lost'],
      default: 'open',
    },
  },
  { timestamps: true },
);

const attachmentSchema = new mongoose.Schema(
  {
    ownerType: {
      type: String,
      required: true,
      trim: true,
    },
    ownerId: {
      type: ObjectId,
      required: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    storageKey: {
      type: String,
      trim: true,
    },
    name: {
      type: String,
      trim: true,
    },
    mimeType: {
      type: String,
      trim: true,
    },
    sizeBytes: {
      type: Number,
      min: 0,
    },
    uploadedBy: {
      type: ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true },
);

const auditLogSchema = new mongoose.Schema(
  {
    actor: {
      type: ObjectId,
      ref: 'User',
    },
    action: {
      type: String,
      required: true,
      trim: true,
    },
    resourceType: {
      type: String,
      required: true,
      trim: true,
    },
    resourceId: ObjectId,
    ipAddress: String,
    userAgent: String,
    metadata: Mixed,
  },
  { timestamps: true },
);

const integrationEventSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      required: true,
      trim: true,
    },
    eventType: {
      type: String,
      required: true,
      trim: true,
    },
    externalId: {
      type: String,
      trim: true,
      index: true,
    },
    payload: Mixed,
    status: {
      type: String,
      enum: ['received', 'processed', 'failed', 'ignored'],
      default: 'received',
    },
    error: String,
  },
  { timestamps: true },
);

const webhookReceiptSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      required: true,
      trim: true,
    },
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    signature: String,
    payload: Mixed,
    receivedAt: {
      type: Date,
      default: Date.now,
    },
    processedAt: Date,
  },
  { timestamps: true },
);

const outboxEventSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      trim: true,
    },
    aggregateType: {
      type: String,
      required: true,
      trim: true,
    },
    aggregateId: {
      type: ObjectId,
      required: true,
    },
    payload: {
      type: Mixed,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'sent', 'failed'],
      default: 'pending',
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    nextAttemptAt: Date,
    processedAt: Date,
  },
  { timestamps: true },
);

export const Permission = mongoose.model('Permission', permissionSchema);
export const Role = mongoose.model('Role', roleSchema);
export const UserRole = mongoose.model('UserRole', userRoleSchema);
export const Team = mongoose.model('Team', teamSchema);
export const TeamMember = mongoose.model('TeamMember', teamMemberSchema);
export const Territory = mongoose.model('Territory', territorySchema);
export const LeadSource = mongoose.model('LeadSource', leadSourceSchema);
export const Campaign = mongoose.model('Campaign', campaignSchema);
export const LeadAssignment = mongoose.model('LeadAssignment', leadAssignmentSchema);
export const LeadStage = mongoose.model('LeadStage', leadStageSchema);
export const LeadStatusHistory = mongoose.model('LeadStatusHistory', leadStatusHistorySchema);
export const Activity = mongoose.model('Activity', activitySchema);
export const FollowUp = mongoose.model('FollowUp', followUpSchema);
export const Meeting = mongoose.model('Meeting', meetingSchema);
export const MeetingHistory = mongoose.model('MeetingHistory', meetingHistorySchema);
export const MeetingMom = mongoose.model('MeetingMom', meetingMomSchema);
export const MomVersion = mongoose.model('MomVersion', momVersionSchema);
export const MomActionItem = mongoose.model('MomActionItem', momActionItemSchema);
export const Notification = mongoose.model('Notification', notificationSchema);
export const NotificationDelivery = mongoose.model('NotificationDelivery', notificationDeliverySchema);
export const NotificationPreference = mongoose.model('NotificationPreference', notificationPreferenceSchema);
export const Customer = mongoose.model('Customer', customerSchema);
export const Contact = mongoose.model('Contact', contactSchema);
export const Deal = mongoose.model('Deal', dealSchema);
export const Attachment = mongoose.model('Attachment', attachmentSchema);
export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
export const IntegrationEvent = mongoose.model('IntegrationEvent', integrationEventSchema);
export const WebhookReceipt = mongoose.model('WebhookReceipt', webhookReceiptSchema);
export const OutboxEvent = mongoose.model('OutboxEvent', outboxEventSchema);
