import { randomUUID } from 'node:crypto';
import { auditEvent } from '../../../services/audit.service.js';
import { Client } from '../../clients/models/client.model.js';
import { Challan } from '../models/challan.model.js';
import { createChallanPdf } from '../services/challan-pdf.service.js';
import { InventoryItem } from '../../inventory/models/item.model.js';
import { StockTransaction } from '../../inventory/models/transaction.model.js';

const FIELDS = ['client', 'site', 'challanDate', 'transportType', 'vehicleNumber', 'eWayBillNumber', 'lineItems', 'freightCharge', 'taxableAmount', 'gstAmount', 'roundOff', 'totalAmount', 'linkedInvoice', 'pdfFileUrl'];
const payload = (body) => FIELDS.reduce((result, field) => (body?.[field] !== undefined ? { ...result, [field]: body[field] } : result), {});
const required = (body) => ['client', 'challanDate', 'taxableAmount', 'totalAmount'].every((field) => body?.[field] !== undefined && String(body[field]).trim() !== '');
const challanNumber = () => `DC-${randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()}`;
const requestedChallanNumber = (value) => /^DC-[A-F0-9]{10}$/.test(String(value || '')) ? value : undefined;

export async function createChallan(req, res) {
  if (!required(req.body)) return res.status(400).json({ error: { message: 'Client, date, taxable amount, and total amount are required' } });
  let challan; const values = payload(req.body); const requestedNumber = requestedChallanNumber(req.body?.challanNumber);
  if (values.site && !await Client.exists({ _id: values.site, parentClient: values.client })) return res.status(400).json({ error: { message: 'Select a site belonging to the selected client' } });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try { challan = await Challan.create({ ...values, challanNumber: attempt === 0 && requestedNumber ? requestedNumber : challanNumber() }); break; }
    catch (error) { if (error?.code !== 11000) throw error; }
  }
  if (!challan) return res.status(409).json({ error: { message: 'Unable to generate a unique challan number. Please try again.' } });
  const deducted = []; const stockTransactions = [];
  try {
    for (const line of (challan.lineItems || []).filter((entry) => entry.inventoryItem)) {
      const quantity = Number(line.quantity);
      const item = await InventoryItem.findOneAndUpdate({ _id: line.inventoryItem, quantityInStock: { $gte: quantity } }, { $inc: { quantityInStock: -quantity } }, { new: true });
      if (!item) throw Object.assign(new Error(`Insufficient stock for ${line.description}`), { statusCode: 409 });
      deducted.push({ item: item._id, quantity });
      const transaction = await StockTransaction.create({ item: item._id, type: 'out', quantity, reference: challan.challanNumber, note: `Delivery challan ${challan.challanNumber}`, purchaseDate: challan.challanDate, performedBy: req.user._id });
      if (transaction?._id) stockTransactions.push(transaction._id);
    }
  } catch (error) {
    await Promise.all(deducted.map(({ item, quantity }) => InventoryItem.findByIdAndUpdate(item, { $inc: { quantityInStock: quantity } })));
    if (stockTransactions.length) await StockTransaction.deleteMany({ _id: { $in: stockTransactions } });
    await Challan.findByIdAndDelete(challan._id);
    throw error;
  }
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
  const challan = await Challan.findById(req.params.id).populate('client', 'name gstin phone billingAddress shippingAddress state stateCode').populate('site', 'name siteName siteAddress shippingAddress state stateCode');
  if (!challan) return res.status(404).json({ error: { message: 'Challan not found' } });
  return res.json({ data: challan });
}

export async function downloadChallanPdf(req, res) {
  const challan = await Challan.findById(req.params.id).populate('client', 'name gstin phone billingAddress shippingAddress state stateCode').populate('site', 'name siteName siteAddress shippingAddress state stateCode');
  if (!challan) return res.status(404).json({ error: { message: 'Challan not found' } });
  const pdf = await createChallanPdf(challan);
  const filename = `challan-${challan.challanNumber.replace(/[^\w-]/g, '_')}.pdf`;
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${filename}"` });
  return res.send(pdf);
}

export async function updateChallan(req, res) {
  const challan = await Challan.findById(req.params.id);
  if (!challan) return res.status(404).json({ error: { message: 'Challan not found' } });
  const values = payload(req.body);
  const client = values.client || challan.client;
  if (values.site && !await Client.exists({ _id: values.site, parentClient: client })) return res.status(400).json({ error: { message: 'Select a site belonging to the selected client' } });
  Object.assign(challan, values);
  await challan.save();
  await auditEvent(req, { action: 'challan.update', entity: 'challan', entityId: challan._id });
  return res.json({ data: challan });
}

export async function deleteChallan(req, res) {
  const challan = await Challan.findById(req.params.id);
  if (!challan) return res.status(404).json({ error: { message: 'Challan not found' } });
  const restored = []; const stockTransactions = [];
  try {
    for (const line of (challan.lineItems || []).filter((entry) => entry.inventoryItem)) {
      const quantity = Number(line.quantity);
      const item = await InventoryItem.findByIdAndUpdate(line.inventoryItem, { $inc: { quantityInStock: quantity } });
      if (!item) throw new Error(`Inventory item no longer exists for ${line.description}`);
      restored.push({ item: line.inventoryItem, quantity });
      const transaction = await StockTransaction.create({ item: line.inventoryItem, type: 'adjustment', quantity, reference: challan.challanNumber, note: `Stock restored after deleting delivery challan ${challan.challanNumber}`, purchaseDate: new Date(), performedBy: req.user._id });
      if (transaction?._id) stockTransactions.push(transaction._id);
    }
    await challan.deleteOne();
  } catch (error) {
    await Promise.all(restored.map(({ item, quantity }) => InventoryItem.findByIdAndUpdate(item, { $inc: { quantityInStock: -quantity } })));
    if (stockTransactions.length) await StockTransaction.deleteMany({ _id: { $in: stockTransactions } });
    throw error;
  }
  await auditEvent(req, { action: 'challan.delete', entity: 'challan', entityId: challan._id, before: challan.toObject() });
  return res.status(204).end();
}
