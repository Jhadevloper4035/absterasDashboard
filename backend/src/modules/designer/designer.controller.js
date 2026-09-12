import mongoose from 'mongoose';
import { Client } from '../clients/models/client.model.js';
import { auditEvent } from '../../services/audit.service.js';
import { signAttachmentUrls, trustedAttachment } from '../../services/upload.service.js';
import { hasDesignerReviewAccess, userRoles } from '../auth/middleware/auth.middleware.js';
import { BOQ_STATUSES, Boq } from './models/boq.model.js';

const validId = (value) => mongoose.isValidObjectId(value);
const isAdmin = (user) => userRoles(user).some((role) => role === 'superadmin' || role === 'admin');
const message = (statusCode, text) => Object.assign(new Error(text), { statusCode });
const cleanComment = (value) => String(value || '').trim().slice(0, 1000);
const cleanText = (value, limit) => String(value || '').trim().slice(0, limit);

export const reviewStatus = (action) => ({ APPROVE: 'APPROVED', REQUEST_REVISION: 'REVISION_REQUESTED', REJECT: 'REJECTED' }[String(action || '').toUpperCase()]);

function attachment(value) {
  const file = trustedAttachment(value);
  if (!file || file.contentType !== 'application/pdf') throw message(400, 'Upload one valid PDF BOQ file');
  return file;
}

async function siteFor(clientId, siteId) {
  if (!validId(clientId) || !validId(siteId)) throw message(400, 'Choose a valid client and site address');
  const site = await Client.findOne({ _id: siteId, parentClient: clientId });
  if (!site) throw message(400, 'Choose a site address belonging to the selected client');
  return site;
}

async function boqData(boq) {
  const data = boq.toObject ? boq.toObject() : boq;
  data.versions = await Promise.all((data.versions || []).map(async (version) => ({ ...version, attachment: (await signAttachmentUrls([version.attachment]))[0] })));
  data.history = await Promise.all((data.history || []).map(async (entry) => ({ ...entry, attachment: entry.attachment ? (await signAttachmentUrls([entry.attachment]))[0] : undefined })));
  return data;
}

function boqQuery(req) {
  const query = {};
  if (!isAdmin(req.user) && !hasDesignerReviewAccess(req.user)) query.createdBy = req.user._id;
  if (validId(req.query.client)) query.client = req.query.client;
  if (validId(req.query.site)) query.clientSite = req.query.site;
  if (BOQ_STATUSES.includes(req.query.status)) query.status = req.query.status;
  if (isAdmin(req.user) && validId(req.query.designer)) query.createdBy = req.query.designer;
  return query;
}

const populate = (query) => query.populate([
  { path: 'client', select: 'name' },
  { path: 'clientSite', select: 'name siteName siteAddress' },
  { path: 'createdBy', select: 'name email' },
  { path: 'versions.uploadedBy', select: 'name email' },
  { path: 'history.performedBy', select: 'name email' },
]);

export async function listClientSites(req, res) {
  const clients = await Client.find({ parentClient: null }).select('name').sort({ name: 1 }).lean();
  const sites = clients.length ? await Client.find({ parentClient: { $in: clients.map((client) => client._id) } }).select('name parentClient siteName siteAddress').sort({ siteName: 1, name: 1 }).lean() : [];
  return res.json({ data: { clients, sites } });
}

export async function listBoqs(req, res) {
  const query = boqQuery(req);
  const [boqs, counts] = await Promise.all([
    populate(Boq.find(query).sort({ updatedAt: -1 })),
    Boq.aggregate([{ $match: query }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);
  const summary = Object.fromEntries(BOQ_STATUSES.map((status) => [status, counts.find((item) => item._id === status)?.count || 0]));
  return res.json({ data: await Promise.all(boqs.map(boqData)), summary });
}

export async function getBoq(req, res) {
  if (!validId(req.params.id)) throw message(400, 'Invalid BOQ id');
  const boq = await populate(Boq.findOne({ ...boqQuery(req), _id: req.params.id }));
  if (!boq) throw message(404, 'BOQ not found');
  return res.json({ data: await boqData(boq) });
}

export async function createBoq(req, res) {
  await siteFor(req.body?.client, req.body?.clientSite);
  const title = cleanText(req.body?.title, 160);
  if (!title) throw message(400, 'BOQ title is required');
  const file = attachment(req.body?.attachment);
  const existing = await Boq.exists({ client: req.body.client, clientSite: req.body.clientSite });
  if (existing) throw message(409, 'A BOQ already exists for this client address. Re-upload it after a revision request.');
  const boq = await Boq.create({
    client: req.body.client,
    clientSite: req.body.clientSite,
    title,
    description: cleanText(req.body?.description, 2000) || undefined,
    versions: [{ number: 1, attachment: file, uploadedBy: req.user._id }],
    history: [{ action: 'SUBMITTED', performedBy: req.user._id }],
    createdBy: req.user._id,
  });
  await auditEvent(req, { action: 'boq.submit', entity: 'boq', entityId: boq._id, after: { status: boq.status, version: 1 } });
  return res.status(201).json({ data: await boqData(await populate(Boq.findById(boq._id))) });
}

export async function resubmitBoq(req, res) {
  if (!validId(req.params.id)) throw message(400, 'Invalid BOQ id');
  const boq = await Boq.findById(req.params.id);
  if (!boq) throw message(404, 'BOQ not found');
  if (!isAdmin(req.user) && String(boq.createdBy) !== String(req.user._id)) throw message(403, 'Forbidden');
  if (boq.status !== 'REVISION_REQUESTED') throw message(409, 'Only BOQs awaiting revision can be re-uploaded');
  const number = boq.versions.length + 1;
  boq.versions.push({ number, attachment: attachment(req.body?.attachment), uploadedBy: req.user._id });
  boq.history.push({ action: 'SUBMITTED', performedBy: req.user._id });
  boq.status = 'PENDING_REVIEW';
  await boq.save();
  await auditEvent(req, { action: 'boq.resubmit', entity: 'boq', entityId: boq._id, after: { status: boq.status, version: number } });
  return res.json({ data: await boqData(await populate(Boq.findById(boq._id))) });
}

export async function reviewBoq(req, res) {
  if (!validId(req.params.id)) throw message(400, 'Invalid BOQ id');
  const action = String(req.body?.action || '').toUpperCase();
  const status = reviewStatus(action);
  if (!status) throw message(400, 'Choose approve, request revision, or reject');
  const comment = cleanComment(req.body?.comment);
  if (['REQUEST_REVISION', 'REJECT'].includes(action) && !comment) throw message(400, 'A review comment is required');
  const reviewAttachment = req.body?.attachment ? trustedAttachment(req.body.attachment) : undefined;
  if (req.body?.attachment && !reviewAttachment) throw message(400, 'Upload a valid review attachment');
  const boq = await Boq.findById(req.params.id);
  if (!boq) throw message(404, 'BOQ not found');
  if (boq.status !== 'PENDING_REVIEW') throw message(409, 'Only BOQs pending review can be reviewed');
  boq.status = status;
  boq.history.push({ action: status, comment: comment || undefined, attachment: reviewAttachment, performedBy: req.user._id });
  await boq.save();
  await auditEvent(req, { action: `boq.${action.toLowerCase()}`, entity: 'boq', entityId: boq._id, after: { status: boq.status, version: boq.versions.length }, details: comment ? { comment } : undefined });
  return res.json({ data: await boqData(await populate(Boq.findById(boq._id))) });
}
