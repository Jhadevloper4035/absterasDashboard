import { Lead, LEAD_STATUSES } from '../models/lead.model.js';
import { User } from '../../../models/user.model.js';
import { auditEvent } from '../../../services/audit.service.js';
import { notifyUsers } from '../../notifications/services/notification.service.js';
import { signAttachmentUrls, trustedAttachment } from '../../../services/upload.service.js';
import { cachedJson, invalidateCache } from '../../../services/redis-cache.service.js';
import { appAccessLevel } from '../../auth/middleware/auth.middleware.js';
const LEAD_UPDATE_FIELDS = ['name', 'source', 'sourceType', 'campaign', 'productInterest', 'email', 'phone', 'company', 'siteAddress', 'googleMapUrl', 'territory', 'leadCost'];
const LEAD_DOCUMENT_TYPES = ['site_images', 'psf', 'boq', 'estimation'];
const CLOSED_LEAD_STATUSES = ['WON', 'LOST', 'ON_HOLD'];

function canAssignLeads(user) {
  return appAccessLevel(user, 'leads') === 2;
}

function leadAssigneeQuery(id) {
  return {
    ...(id ? { _id: id } : {}),
    status: 'active',
    modulePermissions: { $elemMatch: { module: 'leads', access: 'manage' } },
    $nor: [
      { role: { $in: ['admin', 'superadmin'] } },
      { additionalRoles: { $in: ['admin', 'superadmin'] } },
      { accessTypes: { $in: ['admin', 'superadmin'] } },
      { workProfile: { $in: ['admin', 'superadmin'] } },
    ],
  };
}

function forbidden(res) {
  return res.status(403).json({ error: { message: 'Forbidden' } });
}

function leadQueryFor(user, extra = {}) {
  return { ...extra, $or: [{ owner: user._id }, { createdBy: user._id }] };
}

function canDeleteLeads(user) {
  return appAccessLevel(user, 'leads') === 2;
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
  data.documents = await signAttachmentUrls(data.documents || []);
  return data;
}

function cleanAttachments(attachments) {
  return (Array.isArray(attachments) ? attachments : [])
    .map(trustedAttachment)
    .filter(Boolean)
    .slice(0, 10)
    .map(({ key, contentType, originalName, size, checksum }) => ({ key, contentType, originalName, size, checksum }));
}

function cleanDocuments(documents) {
  return (Array.isArray(documents) ? documents : [])
    .map((document) => {
      const attachment = trustedAttachment(document);
      return attachment && LEAD_DOCUMENT_TYPES.includes(document.type) ? { type: document.type, ...attachment } : null;
    })
    .filter(Boolean)
    .slice(0, 20)
    .map(({ type, key, contentType, originalName, size, checksum }) => ({ type, key, contentType, originalName, size, checksum }));
}

function applyLeadPatch(lead, patch) {
  for (const field of LEAD_UPDATE_FIELDS) {
    if (patch[field] !== undefined) lead[field] = patch[field];
  }

  if (patch.email !== undefined) lead.normalizedEmail = undefined;
  if (patch.phone !== undefined) lead.normalizedPhone = undefined;
  if (patch.documents !== undefined) lead.documents = cleanDocuments(patch.documents);
}

function notificationMetadata(user, type, lead) {
  return {
    type,
    leadId: lead._id || lead,
    fromUserId: user._id,
    fromName: user.name || user.email || 'User',
    fromRole: user.role || 'user',
    ...(['lead.assigned', 'lead.closed'].includes(type) && typeof lead === 'object' ? {
      leadName: lead.name,
      leadCompany: lead.company,
      ...(type === 'lead.assigned' ? { leadPhone: lead.phone, leadEmail: lead.email, leadSource: lead.source, assignedAt: new Date().toISOString() } : {
        closureStatus: lead.status,
        closureRemarks: lead.lossComment || lead.statusReason,
        closedAt: lead.closedAt,
      }),
    } : {}),
  };
}

export async function createLead(req, res) {
  if (!canAssignLeads(req.user)) {
    return forbidden(res);
  }

  const {
    owner: requestedOwner,
    sharedWith,
    createdBy,
    assignmentException,
    assignmentHistory,
    status,
    statusHistory,
    ...payload
  } = req.body;

  if (!String(payload.phone || '').trim()) {
    return res.status(400).json({ error: { message: 'Mobile number is required' } });
  }
  if (payload.leadCost !== undefined && (!Number.isFinite(Number(payload.leadCost)) || Number(payload.leadCost) < 0)) {
    return res.status(400).json({ error: { message: 'Lead cost must be a valid non-negative amount' } });
  }
  if (payload.leadCost !== undefined) payload.leadCost = Number(payload.leadCost);
  if (payload.documents !== undefined) payload.documents = cleanDocuments(payload.documents);

  let owner = req.user;
  if (requestedOwner) {
    if (String(requestedOwner) === String(req.user._id)) return res.status(400).json({ error: { message: 'Assign the lead to another active user with Lead Management access' } });
    owner = await User.findOne(leadAssigneeQuery(requestedOwner));
    if (!owner) return res.status(400).json({ error: { message: 'Assign leads to an active user with Lead Management access' } });
  }

  const lead = await Lead.create({
    ...payload,
    createdBy: req.user._id,
    owner: owner._id,
    status: 'ASSIGNED',
    assignmentException: false,
    assignmentHistory: [{ newOwner: owner._id, reason: 'Assigned on creation', rule: 'manual', actor: req.user._id }],
    statusHistory: [{ to: 'ASSIGNED', reason: 'Assigned on creation', actor: req.user._id }],
  });
  if (owner && String(owner._id) !== String(req.user._id)) {
    await notifyUsers([owner._id], {
      title: 'Lead assigned',
      body: lead.name,
      metadata: notificationMetadata(req.user, 'lead.assigned', lead),
    });
  }
  await invalidateCache('lead-lists');
  res.status(201).json({ data: lead });
}

export async function listLeads(req, res) {
  const page = Math.max(Number(req.query.page || 1), 1);
  const limit = Math.min(Math.max(Number(req.query.limit || 25), 1), 50);
  const query = leadQueryFor(req.user);
  if (LEAD_STATUSES.includes(req.query.status)) query.status = req.query.status;
  if (req.query.closed === 'true') query.status = { $in: ['WON', 'LOST', 'ON_HOLD'] };
  if (req.query.closedByMe === 'true') query.statusHistory = { $elemMatch: { actor: req.user._id, to: { $in: CLOSED_LEAD_STATUSES } } };
  if (req.query.assignmentException === 'true') query.assignmentException = true;
  if (req.query.hasMeeting === 'true') query['meetingHistory.startsAt'] = { $exists: true };
  if (req.query.upcomingMeeting === 'true') query['meetingHistory.startsAt'] = { $gte: new Date() };
  if (req.query.scheduledByMe === 'true') query.meetingHistory = { $elemMatch: { scheduledBy: req.user._id, status: 'SCHEDULED' } };
  if (req.query.name) query.name = { $regex: escapeRegex(req.query.name), $options: 'i' };
  if (req.query.phone) query.phone = { $regex: escapeRegex(req.query.phone), $options: 'i' };
  if (req.query.email) query.email = { $regex: escapeRegex(req.query.email), $options: 'i' };
  if (req.query.createdFrom || req.query.createdTo) {
    query.createdAt = {};
    if (req.query.createdFrom) query.createdAt.$gte = new Date(`${req.query.createdFrom}T00:00:00.000Z`);
    if (req.query.createdTo) query.createdAt.$lte = new Date(`${req.query.createdTo}T23:59:59.999Z`);
  }
  if (req.query.meeting === 'scheduled') query['meetingHistory.0'] = { $exists: true };
  if (req.query.meeting === 'none') query['meetingHistory.0'] = { $exists: false };
  const data = await cachedJson('lead-lists', `${req.user._id}:${JSON.stringify(req.query)}`, async () => {
    const [leads, total] = await Promise.all([
      Lead.find(query)
        .populate('owner', 'name email role status')
        .populate('createdBy', 'name email role status')
        .populate('meetingHistory.scheduledBy', 'name email role status')
        .sort(req.query.upcomingMeeting === 'true' ? { 'meetingHistory.startsAt': 1 } : { createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Lead.countDocuments(query),
    ]);
    return { data: leads.map(withCurrentMeeting), meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } };
  }, req.query.fresh === 'true');

  res.json(data);
}

export async function listLeadAssignees(req, res) {
  const users = await User.find({ ...leadAssigneeQuery(), _id: { $ne: req.user._id } }).select('name email status').sort({ name: 1 }).limit(1000);
  return res.json({ data: users });
}

export async function getLead(req, res) {
  const lead = await Lead.findOne(leadQueryFor(req.user, { _id: req.params.id }))
    .populate('owner', 'name email role status')
    .populate('createdBy', 'name email role status')
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
  const { owner, status, statusReason, lossReason, lossComment, ...patch } = req.body;
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
  if (patch.leadCost !== undefined && (!Number.isFinite(Number(patch.leadCost)) || Number(patch.leadCost) < 0)) {
    return res.status(400).json({ error: { message: 'Lead cost must be a valid non-negative amount' } });
  }
  if (patch.leadCost !== undefined) patch.leadCost = Number(patch.leadCost);

  if (status !== undefined) {
    if (!LEAD_STATUSES.includes(status)) {
      return res.status(400).json({ error: { message: 'Invalid lead status' } });
    }
    const wasClosed = CLOSED_LEAD_STATUSES.includes(lead.status);
    const isClosed = CLOSED_LEAD_STATUSES.includes(status);
    if (isClosed && !wasClosed && String(lead.owner || '') !== String(req.user._id)) {
      return res.status(403).json({ error: { message: 'Only the assigned salesperson can close this lead' } });
    }
    if (wasClosed && !isClosed && !canAssignLeads(req.user)) {
      return res.status(403).json({ error: { message: 'Lead Management access is required to reopen a closed lead' } });
    }
    if (status !== lead.status) {
      lead.statusHistory.push({ from: lead.status, to: status, reason: statusReason, actor: req.user._id });
      lead.status = status;
      lead.closedAt = isClosed ? new Date() : undefined;
      if (isClosed && !wasClosed) {
        const assignedBy = [...lead.assignmentHistory].reverse().find((item) => String(item.newOwner || '') === String(lead.owner || ''))?.actor || lead.createdBy;
        notifications.push({ users: [assignedBy], title: 'Lead closed', body: lead.name, type: 'lead.closed' });
      }
    }
    if (statusReason !== undefined) lead.statusReason = statusReason;
    if (lossReason !== undefined) lead.lossReason = lossReason;
    if (lossComment !== undefined) lead.lossComment = lossComment;
  }

  if (owner !== undefined) {
    if (!canAssignLeads(req.user)) {
      return forbidden(res);
    }
    if (String(owner) === String(req.user._id)) return res.status(400).json({ error: { message: 'Assign the lead to another active user with Lead Management access' } });

    const newOwner = await User.findOne(leadAssigneeQuery(owner));

    if (!newOwner) {
      return res.status(400).json({ error: { message: 'Assign leads to an active user with Lead Management access' } });
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
  await invalidateCache('lead-lists');
  if (String(previousOwner || '') !== String(lead.owner || '')) {
    await auditEvent(req, { action: 'lead.assign', entity: 'lead', entityId: lead._id, before: { owner: previousOwner }, after: { owner: lead.owner } });
  }
  if (previousStatus !== lead.status) {
    await auditEvent(req, { action: 'lead.status', entity: 'lead', entityId: lead._id, before: { status: previousStatus }, after: { status: lead.status } });
  }
  await lead.populate([
    { path: 'owner', select: 'name email role status' },
    { path: 'createdBy', select: 'name email role status' },
    { path: 'meetingHistory.scheduledBy', select: 'name email role status' },
    { path: 'notes.createdBy', select: 'name email role status' },
    { path: 'assignmentHistory.previousOwner', select: 'name email role status' },
    { path: 'assignmentHistory.newOwner', select: 'name email role status' },
  ]);

  for (const notification of notifications) {
    await notifyUsers(notification.users.filter((id) => String(id || '') !== String(req.user._id)), {
      title: notification.title,
      body: notification.body,
      metadata: notificationMetadata(req.user, notification.type, lead),
    });
  }

  return res.json({ data: await leadData(lead) });
}

export async function deleteLead(req, res) {
  if (!canDeleteLeads(req.user)) {
    return forbidden(res);
  }

  const lead = await Lead.findOneAndDelete(leadQueryFor(req.user, { _id: req.params.id }));
  if (!lead) {
    return res.status(404).json({ error: { message: 'Lead not found' } });
  }

  await auditEvent(req, { action: 'lead.delete', entity: 'lead', entityId: lead._id, before: { owner: lead.owner, status: lead.status } });
  await invalidateCache('lead-lists');
  return res.json({ data: { id: req.params.id } });
}
