import mongoose from 'mongoose';
import { Client } from '../clients/models/client.model.js';
import { auditEvent } from '../../services/audit.service.js';
import { signAttachmentUrls, trustedAttachment } from '../../services/upload.service.js';
import { userRoles } from '../auth/middleware/auth.middleware.js';
import { SiteMeasurement } from './models/site-measurement.model.js';

const validId = (value) => mongoose.isValidObjectId(value);
const isAdmin = (user) => userRoles(user).some((role) => role === 'superadmin' || role === 'admin');
const message = (statusCode, text) => Object.assign(new Error(text), { statusCode });
const cleanText = (value, limit) => String(value || '').trim().slice(0, limit);

function attachment(value) {
  const file = trustedAttachment(value);
  if (!file || file.contentType !== 'application/pdf') throw message(400, 'Upload one valid PDF site measurement file');
  return file;
}

async function siteFor(clientId, siteId) {
  if (!validId(clientId) || !validId(siteId)) throw message(400, 'Choose a valid client and site address');
  const site = await Client.findOne({ _id: siteId, parentClient: clientId });
  if (!site) throw message(400, 'Choose a site address belonging to the selected client');
}

async function measurementData(measurement) {
  const data = measurement.toObject ? measurement.toObject() : measurement;
  data.attachment = (await signAttachmentUrls([data.attachment]))[0];
  return data;
}

function measurementQuery(req) {
  const query = {};
  if (!isAdmin(req.user)) query.createdBy = req.user._id;
  if (validId(req.query.client)) query.client = req.query.client;
  if (validId(req.query.site)) query.clientSite = req.query.site;
  return query;
}

const populate = (query) => query.populate([
  { path: 'client', select: 'name' },
  { path: 'clientSite', select: 'name siteName siteAddress' },
  { path: 'createdBy', select: 'name email' },
]);

export async function listSiteMeasurements(req, res) {
  const measurements = await populate(SiteMeasurement.find(measurementQuery(req)).sort({ createdAt: -1 }));
  return res.json({ data: await Promise.all(measurements.map(measurementData)) });
}

export async function createSiteMeasurement(req, res) {
  await siteFor(req.body?.client, req.body?.clientSite);
  const title = cleanText(req.body?.title, 160);
  if (!title) throw message(400, 'Site measurement title is required');
  const measurement = await SiteMeasurement.create({
    client: req.body.client,
    clientSite: req.body.clientSite,
    title,
    description: cleanText(req.body?.description, 2000) || undefined,
    attachment: attachment(req.body?.attachment),
    createdBy: req.user._id,
  });
  await auditEvent(req, { action: 'site-measurement.create', entity: 'site-measurement', entityId: measurement._id });
  return res.status(201).json({ data: await measurementData(await populate(SiteMeasurement.findById(measurement._id))) });
}
