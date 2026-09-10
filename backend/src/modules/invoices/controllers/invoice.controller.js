import { randomUUID } from 'node:crypto';
import { auditEvent } from '../../../services/audit.service.js';
import { Client } from '../../clients/models/client.model.js';
import { Invoice } from '../models/invoice.model.js';
import { createInvoicePdf } from '../services/invoice-pdf.service.js';

const INVOICE_FIELDS = ['financialYear', 'client', 'site', 'invoiceDate', 'poNumber', 'poDate', 'grRrNumber', 'transport', 'placeOfSupply', 'placeOfSupplyCode', 'reverseCharge', 'vehicleNumber', 'station', 'dispatchFromAddress', 'lineItems', 'taxableAmount', 'igstAmount', 'cgstAmount', 'sgstAmount', 'roundOff', 'grandTotal', 'status', 'pdfFileUrl'];
const invoiceNumber = (financialYear) => `ABS-${financialYear}-${randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()}`;
const requestedInvoiceNumber = (value, financialYear) => /^\d{4}-\d{2}$/.test(financialYear) && new RegExp(`^ABS-${financialYear}-[A-F0-9]{10}$`).test(String(value || '')) ? value : undefined;

function invoicePayload(body) {
  return INVOICE_FIELDS.reduce((payload, field) => {
    if (body?.[field] !== undefined) payload[field] = body[field];
    return payload;
  }, {});
}

function hasCreateFields(body) {
  return ['financialYear', 'client', 'invoiceDate', 'taxableAmount', 'grandTotal'].every((field) => body?.[field] !== undefined && String(body[field]).trim() !== '');
}

function applyTax(payload) {
  const taxableAmount = Number(payload.taxableAmount) || 0;
  const isHaryana = String(payload.placeOfSupplyCode || '') === '06' || String(payload.placeOfSupply || '').trim().toLowerCase() === 'haryana';
  payload.cgstAmount = isHaryana ? taxableAmount * 0.09 : 0;
  payload.sgstAmount = isHaryana ? taxableAmount * 0.09 : 0;
  payload.igstAmount = isHaryana ? 0 : taxableAmount * 0.18;
  payload.grandTotal = taxableAmount + payload.cgstAmount + payload.sgstAmount + payload.igstAmount + (Number(payload.roundOff) || 0);
}

export async function createInvoice(req, res) {
  if (!hasCreateFields(req.body)) return res.status(400).json({ error: { message: 'Financial year, client, invoice date, taxable amount, and grand total are required' } });
  let invoice; const payload = invoicePayload(req.body); applyTax(payload); const requestedNumber = requestedInvoiceNumber(req.body?.invoiceNumber, payload.financialYear);
  if (payload.site && !await Client.exists({ _id: payload.site, parentClient: payload.client })) return res.status(400).json({ error: { message: 'Select a site belonging to the selected client' } });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try { invoice = await Invoice.create({ ...payload, invoiceNumber: attempt === 0 && requestedNumber ? requestedNumber : invoiceNumber(payload.financialYear) }); break; }
    catch (error) { if (error?.code !== 11000) throw error; }
  }
  if (!invoice) return res.status(409).json({ error: { message: 'Unable to generate a unique invoice number. Please try again.' } });
  await auditEvent(req, { action: 'invoice.create', entity: 'invoice', entityId: invoice._id });
  return res.status(201).json({ data: invoice });
}

export async function listInvoices(req, res) {
  const page = Math.max(Number(req.query.page || 1), 1);
  const limit = Math.min(Math.max(Number(req.query.limit || 25), 1), 100);
  const search = String(req.query.q || '').trim();
  const query = {};
  if (req.query.client) query.client = req.query.client;
  if (req.query.site) query.site = req.query.site;
  if (req.query.status) query.status = req.query.status;
  if (search) query.invoiceNumber = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  const sort = req.query.sort === 'createdAt' ? { createdAt: -1 } : { invoiceDate: -1, createdAt: -1 };
  const [invoices, total] = await Promise.all([
    Invoice.find(query).populate('client', 'name siteName').populate('site', 'name siteName siteAddress').sort(sort).skip((page - 1) * limit).limit(limit),
    Invoice.countDocuments(query),
  ]);
  return res.json({ data: invoices, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } });
}

export async function listInvoiceClients(_req, res) {
  const clients = await Client.find({})
    .select('name siteName siteAddress billingAddress shippingAddress state stateCode parentClient')
    .sort({ name: 1 })
    .limit(100);
  return res.json({ data: clients });
}

export async function getInvoice(req, res) {
  const invoice = await Invoice.findById(req.params.id).populate('client', 'name gstin billingAddress shippingAddress state stateCode').populate('site', 'name siteName siteAddress shippingAddress state stateCode');
  if (!invoice) return res.status(404).json({ error: { message: 'Invoice not found' } });
  return res.json({ data: invoice });
}

export async function downloadInvoicePdf(req, res) {
  const invoice = await Invoice.findById(req.params.id).populate('client', 'name gstin billingAddress shippingAddress').populate('site', 'name siteName siteAddress shippingAddress state stateCode');
  if (!invoice) return res.status(404).json({ error: { message: 'Invoice not found' } });
  const pdf = await createInvoicePdf(invoice);
  const filename = `invoice-${invoice.invoiceNumber.replace(/[^\w-]/g, '_')}.pdf`;
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${filename}"` });
  return res.send(pdf);
}

export async function updateInvoice(req, res) {
  const invoice = await Invoice.findById(req.params.id);
  if (!invoice) return res.status(404).json({ error: { message: 'Invoice not found' } });
  const payload = invoicePayload(req.body);
  applyTax(payload);
  const client = payload.client || invoice.client;
  if (payload.site && !await Client.exists({ _id: payload.site, parentClient: client })) return res.status(400).json({ error: { message: 'Select a site belonging to the selected client' } });
  Object.assign(invoice, payload);
  await invoice.save();
  await auditEvent(req, { action: 'invoice.update', entity: 'invoice', entityId: invoice._id });
  return res.json({ data: invoice });
}
