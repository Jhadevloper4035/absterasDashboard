import { Client } from '../models/client.model.js';
import { auditEvent } from '../../../services/audit.service.js';

const CLIENT_FIELDS = ['name', 'gstin', 'billingAddress', 'shippingAddress', 'state', 'stateCode', 'phone', 'email', 'siteName', 'siteAddress', 'startDate', 'status', 'estimatedValue', 'notes'];

function clientPayload(body) {
  return CLIENT_FIELDS.reduce((payload, field) => {
    if (body?.[field] !== undefined) payload[field] = body[field];
    return payload;
  }, {});
}

export async function createClient(req, res) {
  if (!String(req.body?.name || '').trim()) return res.status(400).json({ error: { message: 'Client name is required' } });
  const client = await Client.create(clientPayload(req.body));
  await auditEvent(req, { action: 'client.create', entity: 'client', entityId: client._id });
  return res.status(201).json({ data: client });
}

export async function listClients(req, res) {
  const page = Math.max(Number(req.query.page || 1), 1);
  const limit = Math.min(Math.max(Number(req.query.limit || 25), 1), 100);
  const search = String(req.query.q || '').trim();
  const query = search ? { $or: ['name', 'siteName', 'phone', 'email'].map((field) => ({ [field]: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } })) } : {};
  const [clients, total] = await Promise.all([Client.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit), Client.countDocuments(query)]);
  return res.json({ data: clients, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } });
}

export async function getClient(req, res) {
  const client = await Client.findById(req.params.id);
  if (!client) return res.status(404).json({ error: { message: 'Client not found' } });
  return res.json({ data: client });
}

export async function updateClient(req, res) {
  const client = await Client.findById(req.params.id);
  if (!client) return res.status(404).json({ error: { message: 'Client not found' } });
  Object.assign(client, clientPayload(req.body));
  await client.save();
  await auditEvent(req, { action: 'client.update', entity: 'client', entityId: client._id });
  return res.json({ data: client });
}
