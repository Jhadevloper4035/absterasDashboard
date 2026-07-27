import { Architect } from '../models/architect.model.js';

export async function listArchitects(req, res) {
  const page = Math.max(Number(req.query.page || 1), 1);
  const limit = Math.min(Math.max(Number(req.query.limit || 10), 1), 50);
  const [architects, total] = await Promise.all([
    Architect.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Architect.countDocuments(),
  ]);

  res.json({ data: architects, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } });
}
