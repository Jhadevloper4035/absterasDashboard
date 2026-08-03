import { Lead, LEAD_STATUSES } from '../models/lead.model.js';
import { User } from '../models/user.model.js';
import { auditEvent } from '../services/audit.service.js';
import { notifyUsers } from '../services/notification.service.js';
import { signAttachmentUrls, trustedAttachment } from '../services/upload.service.js';

const ADMIN_ROLES = ['superadmin', 'admin'];
const LEAD_CREATE_ROLES = [...ADMIN_ROLES, 'sales'];
const LEAD_UPDATE_FIELDS = ['name', 'source', 'sourceType', 'campaign', 'productInterest', 'email', 'phone', 'company', 'siteAddress', 'googleMapUrl', 'territory'];

function canManageLeads(user) {
  return ADMIN_ROLES.includes(user.role);
}

function forbidden(res) {
  return res.status(403).json({ error: { message: 'Forbidden' } });
}

function leadQueryFor(user, extra = {}) {
  return canManageLeads(user) ? extra : { ...extra, owner: user._id };
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function withCurrentMeeting(lead) {
  const data = typeof lead.toObject === 'function' ? lead.toObject() : lead;
  const history = data.meetingHistory || [];
  const latestMeeting = history[history.length - 1];
  data.nextMeeting = latestMeeting?.status === 'CANCELLED' ? undefined : latestMeeting;
  return data;
}

async function leadData(lead) {
  const data = { ...withCurrentMeeting(lead) };
  data.notes = await Promise.all(
    (data.notes || []).map(async (note) => ({
      ...note,
      attachments: await signAttachmentUrls(note.attachments || []),
    })),
  );
  return data;
}

function cleanAttachments(attachments) {
  return (Array.isArray(attachments) ? attachments : [])
    .map(trustedAttachment)
    .filter(Boolean)
    .slice(0, 10)
    .map(({ key, contentType, originalName, size, checksum }) => ({ key, contentType, originalName, size, checksum }));
}

function applyLeadPatch(lead, patch) {
  for (const field of LEAD_UPDATE_FIELDS) {
    if (patch[field] !== undefined) lead[field] = patch[field];
  }

  if (patch.email !== undefined) lead.normalizedEmail = undefined;
  if (patch.phone !== undefined) lead.normalizedPhone = undefined;
}

function notificationMetadata(user, type, leadId) {
  return {
    type,
    leadId,
    fromUserId: user._id,
    fromName: user.name || user.email || 'User',
    fromRole: user.role || 'user',
  };
}

export async function createLead(req, res) {
  if (!LEAD_CREATE_ROLES.includes(req.user?.role)) {
    return forbidden(res);
  }

  const {
    owner,
    sharedWith,
    assignmentException,
    assignmentHistory,
    status,
    statusHistory,
    ...payload
  } = req.body;

  if (!String(payload.phone || '').trim()) {
    return res.status(400).json({ error: { message: 'Mobile number is required' } });
  }

  const lead = await Lead.create({
    ...payload,
    status: 'NEW',
    assignmentException: true,
  });
  res.status(201).json({ data: lead });
}

export async function listLeads(req, res) {
  const page = Math.max(Number(req.query.page || 1), 1);
  const limit = Math.min(Math.max(Number(req.query.limit || 25), 1), 50);
  const query = leadQueryFor(req.user);
  if (LEAD_STATUSES.includes(req.query.status)) query.status = req.query.status;
  if (req.query.assignmentException === 'true') query.assignmentException = true;
  if (req.query.hasMeeting === 'true') query['meetingHistory.startsAt'] = { $exists: true };
  if (req.query.upcomingMeeting === 'true') query['meetingHistory.startsAt'] = { $gte: new Date() };
  if (req.query.name) query.name = { $regex: escapeRegex(req.query.name), $options: 'i' };
  if (req.query.phone) query.phone = { $regex: escapeRegex(req.query.phone), $options: 'i' };
  if (req.query.email) query.email = { $regex: escapeRegex(req.query.email), $options: 'i' };
  if (canManageLeads(req.user) && req.query.owner) {
    if (req.query.owner === 'unassigned') query.owner = null;
    else query.owner = req.query.owner;
  }
  if (req.query.createdFrom || req.query.createdTo) {
    query.createdAt = {};
    if (req.query.createdFrom) query.createdAt.$gte = new Date(`${req.query.createdFrom}T00:00:00.000Z`);
    if (req.query.createdTo) query.createdAt.$lte = new Date(`${req.query.createdTo}T23:59:59.999Z`);
  }
  if (req.query.meeting === 'scheduled') query['meetingHistory.0'] = { $exists: true };
  if (req.query.meeting === 'none') query['meetingHistory.0'] = { $exists: false };
  const [leads, total] = await Promise.all([
    Lead.find(query)
      .populate('owner', 'name email role status')
      .populate('meetingHistory.scheduledBy', 'name email role status')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Lead.countDocuments(query),
  ]);

  res.json({ data: leads.map(withCurrentMeeting), meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } });
}

export async function getLead(req, res) {
  const lead = await Lead.findOne(leadQueryFor(req.user, { _id: req.params.id }))
    .populate('owner', 'name email role status')
    .populate('meetingHistory.scheduledBy', 'name email role status')
    .populate('notes.createdBy', 'name email role status')
    .populate('assignmentHistory.previousOwner', 'name email role status')
    .populate('assignmentHistory.newOwner', 'name email role status');

  if (!lead) {
    return res.status(404).json({ error: { message: 'Lead not found' } });
  }

  return res.json({ data: await leadData(lead) });
}

export async function updateLead(req, res) {
  const { owner, ...patch } = req.body;
  const lead = await Lead.findOne(leadQueryFor(req.user, { _id: req.params.id }));
  const notifications = [];
  const previousStatus = lead?.status;
  const previousOwner = lead?.owner;

  if (!lead) {
    return res.status(404).json({ error: { message: 'Lead not found' } });
  }

  if (patch.phone !== undefined && !String(patch.phone).trim()) {
    return res.status(400).json({ error: { message: 'Mobile number is required' } });
  }

  if (owner !== undefined) {
    if (!canManageLeads(req.user)) {
      return forbidden(res);
    }

    const newOwner = await User.findOne({ _id: owner, role: 'sales', status: 'active' });

    if (!newOwner) {
      return res.status(400).json({ error: { message: 'Assign leads to an active salesperson' } });
    }

    if (String(lead.owner || '') !== String(newOwner._id)) {
      lead.assignmentHistory.push({
        previousOwner: lead.owner,
        newOwner: newOwner._id,
        reason: patch.assignmentReason || 'Manual assignment',
        rule: 'manual',
        actor: req.user._id,
      });
      lead.statusHistory.push({
        from: lead.status,
        to: 'ASSIGNED',
        reason: patch.assignmentReason || 'Manual assignment',
        actor: req.user._id,
      });
    }

    lead.owner = newOwner._id;
    lead.status = 'ASSIGNED';
    notifications.push({
      users: [newOwner._id],
      title: 'Lead assigned',
      body: lead.name,
      type: 'lead.assigned',
    });
  }

  if (patch.noteText || patch.noteAttachments !== undefined || patch.specialSampleRequired !== undefined) {
    lead.notes.push({
      text: String(patch.noteText || '').trim(),
      attachments: cleanAttachments(patch.noteAttachments),
      specialSampleRequired: Boolean(patch.specialSampleRequired),
      createdBy: req.user._id,
    });
    notifications.push({
      users: [lead.owner],
      title: 'Lead note added',
      body: lead.name,
      type: 'lead.note',
    });
  }

  if (patch.nextMeeting) {
    const startsAt = new Date(patch.nextMeeting.startsAt);

    if (!lead.owner) {
      return res.status(400).json({ error: { message: 'Assign lead before scheduling a meeting' } });
    }

    if (Number.isNaN(startsAt.getTime())) {
      return res.status(400).json({ error: { message: 'Meeting date is required' } });
    }

    const scheduledAt = new Date();
    const meeting = {
      title: patch.nextMeeting.title || 'Next meeting',
      startsAt,
      notes: patch.nextMeeting.notes,
      scheduledBy: req.user._id,
      scheduledAt,
      status: 'SCHEDULED',
    };
    lead.meetingHistory = lead.meetingHistory || [];
    lead.meetingHistory.push(meeting);

    if (lead.status !== 'MEETING_SCHEDULED') {
      lead.statusHistory.push({
        from: lead.status,
        to: 'MEETING_SCHEDULED',
        reason: 'Next meeting scheduled',
        actor: req.user._id,
      });
      lead.status = 'MEETING_SCHEDULED';
    }
    notifications.push({
      users: [lead.owner],
      title: 'Meeting scheduled',
      body: `${lead.name}: ${meeting.title}`,
      type: 'lead.meeting',
    });
  }

  if (patch.cancelMeeting) {
    const history = lead.meetingHistory || [];
    const latestMeeting = history[history.length - 1];

    if (!latestMeeting || latestMeeting.status === 'CANCELLED') {
      return res.status(400).json({ error: { message: 'No scheduled meeting to cancel' } });
    }

    lead.meetingHistory.push({
      title: latestMeeting.title,
      startsAt: latestMeeting.startsAt,
      notes: patch.cancelMeetingNote || latestMeeting.notes,
      scheduledBy: req.user._id,
      scheduledAt: new Date(),
      status: 'CANCELLED',
    });
    lead.statusHistory.push({
      from: lead.status,
      to: 'CONTACTED',
      reason: 'Meeting cancelled',
      actor: req.user._id,
    });
    lead.status = 'CONTACTED';
    notifications.push({
      users: [lead.owner],
      title: 'Meeting cancelled',
      body: lead.name,
      type: 'lead.meeting.cancelled',
    });
  }

  applyLeadPatch(lead, patch);

  await lead.save();
  if (String(previousOwner || '') !== String(lead.owner || '')) {
    await auditEvent(req, { action: 'lead.assign', entity: 'lead', entityId: lead._id, before: { owner: previousOwner }, after: { owner: lead.owner } });
  }
  if (previousStatus !== lead.status) {
    await auditEvent(req, { action: 'lead.status', entity: 'lead', entityId: lead._id, before: { status: previousStatus }, after: { status: lead.status } });
  }
  await lead.populate([
    { path: 'owner', select: 'name email role status' },
    { path: 'meetingHistory.scheduledBy', select: 'name email role status' },
    { path: 'notes.createdBy', select: 'name email role status' },
    { path: 'assignmentHistory.previousOwner', select: 'name email role status' },
    { path: 'assignmentHistory.newOwner', select: 'name email role status' },
  ]);

  for (const notification of notifications) {
    await notifyUsers(notification.users.filter((id) => String(id || '') !== String(req.user._id)), {
      title: notification.title,
      body: notification.body,
      metadata: notificationMetadata(req.user, notification.type, lead._id),
    });
  }

  return res.json({ data: await leadData(lead) });
}

export async function deleteLead(req, res) {
  if (!canManageLeads(req.user)) {
    return forbidden(res);
  }

  const lead = await Lead.findOneAndDelete({ _id: req.params.id });
  if (!lead) {
    return res.status(404).json({ error: { message: 'Lead not found' } });
  }

  await auditEvent(req, { action: 'lead.delete', entity: 'lead', entityId: lead._id, before: { owner: lead.owner, status: lead.status } });
  return res.json({ data: { id: req.params.id } });
}
