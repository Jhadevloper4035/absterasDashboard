import { Lead } from '../models/lead.model.js';

export async function createLead(req, res) {
  const lead = await Lead.create(req.body);
  res.status(201).json({ data: lead });
}

export async function listLeads(req, res) {
  const leads = await Lead.find().sort({ createdAt: -1 }).limit(50);
  res.json({ data: leads });
}

export async function getLead(req, res) {
  const lead = await Lead.findById(req.params.id);

  if (!lead) {
    return res.status(404).json({ error: { message: 'Lead not found' } });
  }

  return res.json({ data: lead });
}

export async function updateLead(req, res) {
  const lead = await Lead.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!lead) {
    return res.status(404).json({ error: { message: 'Lead not found' } });
  }

  return res.json({ data: lead });
}
