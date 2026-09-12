import mongoose from 'mongoose';
import { Client } from '../clients/models/client.model.js';
import { auditEvent } from '../../services/audit.service.js';
import { signAttachmentUrls, trustedAttachment } from '../../services/upload.service.js';
import { hasDesignerReviewAccess, userRoles } from '../auth/middleware/auth.middleware.js';
import { DRAWING_STATUSES, Drawing } from './models/drawing.model.js';

const validId = (value) => mongoose.isValidObjectId(value);
const isAdmin = (user) => userRoles(user).some((role) => role === 'superadmin' || role === 'admin');
const message = (statusCode, text) => Object.assign(new Error(text), { statusCode });
const cleanComment = (value) => String(value || '').trim().slice(0, 1000);
const cleanText = (value, limit) => String(value || '').trim().slice(0, limit);
export const reviewStatus = (action) => ({ APPROVE: 'APPROVED', REQUEST_REVISION: 'REVISION_REQUESTED', REJECT: 'REJECTED' }[String(action || '').toUpperCase()]);

function attachment(value) {
  const file = trustedAttachment(value);
  if (!file || file.contentType !== 'application/pdf') throw message(400, 'Upload one valid PDF drawing file');
  return file;
}

async function siteFor(clientId, siteId) {
  if (!validId(clientId) || !validId(siteId)) throw message(400, 'Choose a valid client and site address');
  const site = await Client.findOne({ _id: siteId, parentClient: clientId });
  if (!site) throw message(400, 'Choose a site address belonging to the selected client');
}

async function drawingData(drawing) {
  const data = drawing.toObject ? drawing.toObject() : drawing;
  data.versions = await Promise.all((data.versions || []).map(async (version) => ({ ...version, attachment: (await signAttachmentUrls([version.attachment]))[0] })));
  data.history = await Promise.all((data.history || []).map(async (entry) => ({ ...entry, attachment: entry.attachment ? (await signAttachmentUrls([entry.attachment]))[0] : undefined })));
  return data;
}

function drawingQuery(req) {
  const query = {};
  if (!isAdmin(req.user) && !hasDesignerReviewAccess(req.user)) query.createdBy = req.user._id;
  if (validId(req.query.client)) query.client = req.query.client;
  if (validId(req.query.site)) query.clientSite = req.query.site;
  if (DRAWING_STATUSES.includes(req.query.status)) query.status = req.query.status;
  if (isAdmin(req.user) && validId(req.query.designer)) query.createdBy = req.query.designer;
  return query;
}

const populate = (query) => query.populate([
  { path: 'client', select: 'name' }, { path: 'clientSite', select: 'name siteName siteAddress' }, { path: 'createdBy', select: 'name email' },
  { path: 'versions.uploadedBy', select: 'name email' }, { path: 'history.performedBy', select: 'name email' },
]);

export async function listDrawings(req, res) {
  const query = drawingQuery(req);
  const [drawings, counts] = await Promise.all([populate(Drawing.find(query).sort({ updatedAt: -1 })), Drawing.aggregate([{ $match: query }, { $group: { _id: '$status', count: { $sum: 1 } } }])]);
  const summary = Object.fromEntries(DRAWING_STATUSES.map((status) => [status, counts.find((item) => item._id === status)?.count || 0]));
  return res.json({ data: await Promise.all(drawings.map(drawingData)), summary });
}

export async function getDrawing(req, res) {
  if (!validId(req.params.id)) throw message(400, 'Invalid drawing id');
  const drawing = await populate(Drawing.findOne({ ...drawingQuery(req), _id: req.params.id }));
  if (!drawing) throw message(404, 'Drawing not found');
  return res.json({ data: await drawingData(drawing) });
}

export async function createDrawing(req, res) {
  await siteFor(req.body?.client, req.body?.clientSite);
  const title = cleanText(req.body?.title, 160);
  if (!title) throw message(400, 'Drawing title is required');
  const existing = await Drawing.exists({ client: req.body.client, clientSite: req.body.clientSite });
  if (existing) throw message(409, 'A drawing already exists for this client address. Re-upload it after a revision request.');
  const drawing = await Drawing.create({ client: req.body.client, clientSite: req.body.clientSite, title, description: cleanText(req.body?.description, 2000) || undefined, versions: [{ number: 1, attachment: attachment(req.body?.attachment), uploadedBy: req.user._id }], history: [{ action: 'SUBMITTED', performedBy: req.user._id }], createdBy: req.user._id });
  await auditEvent(req, { action: 'drawing.submit', entity: 'drawing', entityId: drawing._id, after: { status: drawing.status, version: 1 } });
  return res.status(201).json({ data: await drawingData(await populate(Drawing.findById(drawing._id))) });
}

export async function resubmitDrawing(req, res) {
  if (!validId(req.params.id)) throw message(400, 'Invalid drawing id');
  const drawing = await Drawing.findById(req.params.id);
  if (!drawing) throw message(404, 'Drawing not found');
  if (!isAdmin(req.user) && String(drawing.createdBy) !== String(req.user._id)) throw message(403, 'Forbidden');
  if (drawing.status !== 'REVISION_REQUESTED') throw message(409, 'Only drawings awaiting revision can be re-uploaded');
  const number = drawing.versions.length + 1;
  drawing.versions.push({ number, attachment: attachment(req.body?.attachment), uploadedBy: req.user._id });
  drawing.history.push({ action: 'SUBMITTED', performedBy: req.user._id });
  drawing.status = 'PENDING_REVIEW';
  await drawing.save();
  await auditEvent(req, { action: 'drawing.resubmit', entity: 'drawing', entityId: drawing._id, after: { status: drawing.status, version: number } });
  return res.json({ data: await drawingData(await populate(Drawing.findById(drawing._id))) });
}

export async function reviewDrawing(req, res) {
  if (!validId(req.params.id)) throw message(400, 'Invalid drawing id');
  const action = String(req.body?.action || '').toUpperCase();
  const status = reviewStatus(action);
  if (!status) throw message(400, 'Choose approve, request revision, or reject');
  const comment = cleanComment(req.body?.comment);
  if (['REQUEST_REVISION', 'REJECT'].includes(action) && !comment) throw message(400, 'A review comment is required');
  const reviewAttachment = req.body?.attachment ? trustedAttachment(req.body.attachment) : undefined;
  if (req.body?.attachment && !reviewAttachment) throw message(400, 'Upload a valid review attachment');
  const drawing = await Drawing.findById(req.params.id);
  if (!drawing) throw message(404, 'Drawing not found');
  if (drawing.status !== 'PENDING_REVIEW') throw message(409, 'Only drawings pending review can be reviewed');
  drawing.status = status;
  drawing.history.push({ action: status, comment: comment || undefined, attachment: reviewAttachment, performedBy: req.user._id });
  await drawing.save();
  await auditEvent(req, { action: `drawing.${action.toLowerCase()}`, entity: 'drawing', entityId: drawing._id, after: { status: drawing.status, version: drawing.versions.length }, details: comment ? { comment } : undefined });
  return res.json({ data: await drawingData(await populate(Drawing.findById(drawing._id))) });
}
