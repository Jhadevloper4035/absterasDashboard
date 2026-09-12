import mongoose from 'mongoose';
import { Client } from '../clients/models/client.model.js';
import { auditEvent } from '../../services/audit.service.js';
import { signAttachmentUrls, trustedAttachment } from '../../services/upload.service.js';
import { userRoles } from '../auth/middleware/auth.middleware.js';
import { Boq } from './models/boq.model.js';
import { Drawing } from './models/drawing.model.js';
import { ProductionData } from './models/production-data.model.js';
import { SiteMeasurement } from './models/site-measurement.model.js';

const validId = (value) => mongoose.isValidObjectId(value);
const isAdmin = (user) => userRoles(user).some((role) => role === 'superadmin' || role === 'admin');
const message = (statusCode, text) => Object.assign(new Error(text), { statusCode });
const cleanText = (value, limit) => String(value || '').trim().slice(0, limit);

function attachments(value) {
  const files = Array.isArray(value) ? value : value ? [value] : [];
  if (!files.length || files.length > 5) throw message(400, 'Upload between one and five production data files');
  const validFiles = files.map(trustedAttachment);
  if (validFiles.some((file) => !file || !['application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'].includes(file.contentType))) throw message(400, 'Upload valid PDF or Excel production data files');
  return validFiles;
}

async function siteFor(clientId, siteId) {
  if (!validId(clientId) || !validId(siteId)) throw message(400, 'Choose a valid client and site address');
  const site = await Client.findOne({ _id: siteId, parentClient: clientId });
  if (!site) throw message(400, 'Choose a site address belonging to the selected client');
}

async function eligibility(client, clientSite, includeDocuments = false) {
  const [boq, drawing, measurements, productionData] = await Promise.all([
    Boq.findOne({ client, clientSite }).select('title status versions').lean(),
    Drawing.findOne({ client, clientSite }).select('title status versions').lean(),
    SiteMeasurement.find({ client, clientSite }).select('title attachment createdAt').sort({ createdAt: -1 }).lean(),
    ProductionData.exists({ client, clientSite }),
  ]);
  const requirements = {
    boqApproved: boq?.status === 'APPROVED',
    drawingApproved: drawing?.status === 'APPROVED',
    siteMeasurementExists: measurements.length > 0,
    productionDataExists: Boolean(productionData),
    canCreate: Boolean(boq?.status === 'APPROVED' && drawing?.status === 'APPROVED' && measurements.length && !productionData),
  };
  if (!includeDocuments) return requirements;

  const documentSources = (document, label) => (document?.versions || []).slice().reverse().map((version, index) => ({ key: version.attachment.key, title: `${label} v${version.number} — ${version.attachment.originalName || `${label} PDF`}`, status: index === 0 ? document.status : undefined, attachment: version.attachment }));
  const boqs = documentSources(boq, 'BOQ');
  const drawings = documentSources(drawing, 'Drawing');
  const siteMeasurements = measurements.map((measurement) => ({ key: measurement.attachment.key, title: measurement.title, createdAt: measurement.createdAt, attachment: measurement.attachment }));
  const sources = [...boqs, ...drawings, ...siteMeasurements];
  const signedAttachments = await signAttachmentUrls(sources.map((source) => source.attachment));
  const signedSources = sources.map((source, index) => ({ ...source, attachment: signedAttachments[index] }));
  return {
    ...requirements,
    documents: {
      boqs: signedSources.slice(0, boqs.length),
      drawings: signedSources.slice(boqs.length, boqs.length + drawings.length),
      siteMeasurements: signedSources.slice(boqs.length + drawings.length),
    },
  };
}

async function selectedSources(client, clientSite, selections) {
  const [boq, drawing, measurements] = await Promise.all([
    Boq.findOne({ client, clientSite }).select('versions').lean(),
    Drawing.findOne({ client, clientSite }).select('versions').lean(),
    SiteMeasurement.find({ client, clientSite }).select('attachment').lean(),
  ]);
  const sourceDocuments = {
    boq: boq?.versions?.find((version) => version.attachment.key === selections?.boq)?.attachment,
    drawing: drawing?.versions?.find((version) => version.attachment.key === selections?.drawing)?.attachment,
    siteMeasurement: measurements.find((measurement) => measurement.attachment.key === selections?.siteMeasurement)?.attachment,
  };
  if (!sourceDocuments.boq || !sourceDocuments.drawing || !sourceDocuments.siteMeasurement) throw message(400, 'Select a BOQ, Drawing, and Site Measurement for this address');
  return sourceDocuments;
}

async function productionDataValue(productionData) {
  const data = productionData.toObject ? productionData.toObject() : productionData;
  data.attachments = await signAttachmentUrls(data.attachments?.length ? data.attachments : data.attachment ? [data.attachment] : []);
  return data;
}

function productionDataQuery(req) {
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

export async function getProductionDataEligibility(req, res) {
  await siteFor(req.query.client, req.query.site);
  return res.json({ data: await eligibility(req.query.client, req.query.site, true) });
}

export async function listProductionData(req, res) {
  const records = await populate(ProductionData.find(productionDataQuery(req)).sort({ createdAt: -1 }));
  return res.json({ data: await Promise.all(records.map(productionDataValue)) });
}

export async function createProductionData(req, res) {
  await siteFor(req.body?.client, req.body?.clientSite);
  const title = cleanText(req.body?.title, 160);
  if (!title) throw message(400, 'Production data title is required');
  const requirements = await eligibility(req.body.client, req.body.clientSite);
  if (requirements.productionDataExists) throw message(409, 'Production data already exists for this client address');
  const missing = [!requirements.boqApproved && 'approved BOQ', !requirements.drawingApproved && 'approved Drawing', !requirements.siteMeasurementExists && 'site measurement'].filter(Boolean);
  if (missing.length) throw message(409, `Production data is locked until this address has ${missing.join(', ')}`);
  const sourceDocuments = await selectedSources(req.body.client, req.body.clientSite, req.body?.sourceDocuments);
  const productionData = await ProductionData.create({
    client: req.body.client,
    clientSite: req.body.clientSite,
    title,
    description: cleanText(req.body?.description, 2000) || undefined,
    sourceDocuments,
    attachments: attachments(req.body?.attachments),
    createdBy: req.user._id,
  });
  await auditEvent(req, { action: 'production-data.create', entity: 'production-data', entityId: productionData._id });
  return res.status(201).json({ data: await productionDataValue(await populate(ProductionData.findById(productionData._id))) });
}
