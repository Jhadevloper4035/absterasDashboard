import { Architect } from '../models/architect.model.js';
import { auditEvent } from '../services/audit.service.js';

const ARCHITECT_CREATE_FIELDS = ['name', 'phone', 'email', 'company', 'city', 'specialty', 'notes'];

function architectPayload(body) {
  return ARCHITECT_CREATE_FIELDS.reduce((payload, field) => {
    if (body[field] !== undefined) payload[field] = body[field];
    return payload;
  }, {});
}

export async function createArchitect(req, res) {
  if (!String(req.body?.name || '').trim()) {
    return res.status(400).json({ error: { message: 'Architect name is required' } });
  }

  if (!String(req.body?.phone || '').trim()) {
    return res.status(400).json({ error: { message: 'Mobile number is required' } });
  }

  const architect = await Architect.create(architectPayload(req.body));
  return res.status(201).json({ data: architect });
}

export async function listArchitects(req, res) {
  const page = Math.max(Number(req.query.page || 1), 1);
  const limit = Math.min(Math.max(Number(req.query.limit || 10), 1), 50);
  const [architects, total] = await Promise.all([
    Architect.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Architect.countDocuments(),
  ]);

  res.json({ data: architects, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } });
}

export async function deleteArchitect(req, res) {
  const architect = await Architect.findOneAndDelete({ _id: req.params.id });
  if (!architect) {
    return res.status(404).json({ error: { message: 'Architect lead not found' } });
  }

  await auditEvent(req, { action: 'architect.delete', entity: 'architect', entityId: architect._id });
  return res.json({ data: { id: req.params.id } });
}
