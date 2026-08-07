import { auditEvent } from '../../../services/audit.service.js';
import { Challan } from '../models/challan.model.js';
import { createChallanPdf } from '../services/challan-pdf.service.js';

const FIELDS = ['challanNumber', 'client', 'challanDate', 'transportType', 'vehicleNumber', 'eWayBillNumber', 'lineItems', 'freightCharge', 'taxableAmount', 'gstAmount', 'roundOff', 'totalAmount', 'linkedInvoice', 'pdfFileUrl'];
const payload = (body) => FIELDS.reduce((result, field) => (body?.[field] !== undefined ? { ...result, [field]: body[field] } : result), {});
const required = (body) => ['challanNumber', 'client', 'challanDate', 'taxableAmount', 'totalAmount'].every((field) => body?.[field] !== undefined && String(body[field]).trim() !== '');

export async function createChallan(req, res) {
  if (!required(req.body)) return res.status(400).json({ error: { message: 'Challan number, client, date, taxable amount, and total amount are required' } });
  const challan = await Challan.create(payload(req.body));
  await auditEvent(req, { action: 'challan.create', entity: 'challan', entityId: challan._id });
  return res.status(201).json({ data: challan });
}

export async function listChallans(req, res) {
  const page = Math.max(Number(req.query.page || 1), 1);
  const limit = Math.min(Math.max(Number(req.query.limit || 25), 1), 100);
  const search = String(req.query.q || '').trim();
  const query = {};
  if (req.query.client) query.client = req.query.client;
  if (search) query.challanNumber = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  const [challans, total] = await Promise.all([Challan.find(query).populate('client', 'name siteName').sort({ challanDate: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit), Challan.countDocuments(query)]);
  return res.json({ data: challans, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } });
}

export async function getChallan(req, res) {
  const challan = await Challan.findById(req.params.id).populate('client', 'name gstin phone billingAddress shippingAddress state stateCode');
  if (!challan) return res.status(404).json({ error: { message: 'Challan not found' } });
  return res.json({ data: challan });
}

export async function downloadChallanPdf(req, res) {
  const challan = await Challan.findById(req.params.id).populate('client', 'name gstin phone billingAddress shippingAddress state stateCode');
  if (!challan) return res.status(404).json({ error: { message: 'Challan not found' } });
  const pdf = await createChallanPdf(challan);
  const filename = `challan-${challan.challanNumber.replace(/[^\w-]/g, '_')}.pdf`;
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${filename}"` });
  return res.send(pdf);
}

export async function updateChallan(req, res) {
  const challan = await Challan.findById(req.params.id);
  if (!challan) return res.status(404).json({ error: { message: 'Challan not found' } });
  Object.assign(challan, payload(req.body));
  await challan.save();
  await auditEvent(req, { action: 'challan.update', entity: 'challan', entityId: challan._id });
  return res.json({ data: challan });
}
