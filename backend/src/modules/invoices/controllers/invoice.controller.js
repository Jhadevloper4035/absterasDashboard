import { auditEvent } from '../../../services/audit.service.js';
import { Invoice } from '../models/invoice.model.js';
import { createInvoicePdf } from '../services/invoice-pdf.service.js';

const INVOICE_FIELDS = ['invoiceNumber', 'financialYear', 'client', 'invoiceDate', 'grRrNumber', 'transport', 'placeOfSupply', 'placeOfSupplyCode', 'reverseCharge', 'vehicleNumber', 'station', 'lineItems', 'taxableAmount', 'igstAmount', 'cgstAmount', 'sgstAmount', 'roundOff', 'grandTotal', 'status', 'pdfFileUrl'];

function invoicePayload(body) {
  return INVOICE_FIELDS.reduce((payload, field) => {
    if (body?.[field] !== undefined) payload[field] = body[field];
    return payload;
  }, {});
}

function hasCreateFields(body) {
  return ['invoiceNumber', 'financialYear', 'client', 'invoiceDate', 'taxableAmount', 'grandTotal'].every((field) => body?.[field] !== undefined && String(body[field]).trim() !== '');
}

export async function createInvoice(req, res) {
  if (!hasCreateFields(req.body)) return res.status(400).json({ error: { message: 'Invoice number, financial year, client, invoice date, taxable amount, and grand total are required' } });
  const invoice = await Invoice.create(invoicePayload(req.body));
  await auditEvent(req, { action: 'invoice.create', entity: 'invoice', entityId: invoice._id });
  return res.status(201).json({ data: invoice });
}

export async function listInvoices(req, res) {
  const page = Math.max(Number(req.query.page || 1), 1);
  const limit = Math.min(Math.max(Number(req.query.limit || 25), 1), 100);
  const search = String(req.query.q || '').trim();
  const query = {};
  if (req.query.client) query.client = req.query.client;
  if (req.query.status) query.status = req.query.status;
  if (search) query.invoiceNumber = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  const [invoices, total] = await Promise.all([
    Invoice.find(query).populate('client', 'name siteName').sort({ invoiceDate: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Invoice.countDocuments(query),
  ]);
  return res.json({ data: invoices, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } });
}

export async function getInvoice(req, res) {
  const invoice = await Invoice.findById(req.params.id).populate('client', 'name gstin billingAddress shippingAddress state stateCode');
  if (!invoice) return res.status(404).json({ error: { message: 'Invoice not found' } });
  return res.json({ data: invoice });
}

export async function downloadInvoicePdf(req, res) {
  const invoice = await Invoice.findById(req.params.id).populate('client', 'name gstin billingAddress shippingAddress');
  if (!invoice) return res.status(404).json({ error: { message: 'Invoice not found' } });
  const pdf = await createInvoicePdf(invoice);
  const filename = `invoice-${invoice.invoiceNumber.replace(/[^\w-]/g, '_')}.pdf`;
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${filename}"` });
  return res.send(pdf);
}

export async function updateInvoice(req, res) {
  const invoice = await Invoice.findById(req.params.id);
  if (!invoice) return res.status(404).json({ error: { message: 'Invoice not found' } });
  Object.assign(invoice, invoicePayload(req.body));
  await invoice.save();
  await auditEvent(req, { action: 'invoice.update', entity: 'invoice', entityId: invoice._id });
  return res.json({ data: invoice });
}
