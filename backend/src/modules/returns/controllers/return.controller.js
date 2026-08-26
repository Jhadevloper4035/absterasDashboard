import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { auditEvent } from '../../../services/audit.service.js';
import { Challan } from '../../challans/models/challan.model.js';
import { Client } from '../../clients/models/client.model.js';
import { ReturnProduct } from '../models/return-product.model.js';
import { ReturnRecord } from '../models/return-record.model.js';

const isId = (value) => mongoose.isObjectIdOrHexString(value);
const returnNumber = () => `RET-${randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()}`;
const challanNumber = () => `DC-${randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()}`;
const pageParams = (query) => ({ page: Math.max(Number.parseInt(query.page, 10) || 1, 1), limit: Math.min(Math.max(Number.parseInt(query.limit, 10) || 25, 1), 100) });

function returnItems(items) {
  if (!Array.isArray(items) || !items.length) return null;
  const result = items.map((item) => ({
    name: String(item?.name || '').trim(),
    description: String(item?.description || '').trim() || undefined,
    quantity: Number(item?.quantity),
    unit: String(item?.unit || '').trim(),
  }));
  return result.every((item) => item.name && item.unit && Number.isFinite(item.quantity) && item.quantity > 0) ? result : null;
}

async function validSite(client, site) {
  return isId(site) && Client.exists({ _id: site, parentClient: client });
}

async function createWithNumber(Model, values, nextNumber) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try { return await Model.create({ ...values, [Model === ReturnRecord ? 'returnNumber' : 'challanNumber']: nextNumber() }); }
    catch (error) { if (error?.code !== 11000) throw error; }
  }
  return null;
}

export async function createReturn(req, res) {
  const { client, sourceSite, destinationSite, pickupDate, storageLocation, notes } = req.body || {};
  const disposition = destinationSite ? 'site_transfer' : 'return_stock';
  const items = returnItems(req.body?.items);
  if (!isId(client) || !await Client.exists({ _id: client, parentClient: null })) return res.status(400).json({ error: { message: 'Select a valid client' } });
  if (!await validSite(client, sourceSite)) return res.status(400).json({ error: { message: 'Select a pickup site belonging to the selected client' } });
  if (destinationSite && (!await validSite(client, destinationSite) || String(destinationSite) === String(sourceSite))) return res.status(400).json({ error: { message: 'Select a different destination site belonging to the selected client' } });
  if (!items) return res.status(400).json({ error: { message: 'Add at least one returned material with quantity and unit' } });
  if (!pickupDate || Number.isNaN(Date.parse(pickupDate))) return res.status(400).json({ error: { message: 'Pickup date is required' } });

  const record = await createWithNumber(ReturnRecord, { client, sourceSite, destinationSite: destinationSite || undefined, pickupDate, disposition, storageLocation: disposition === 'return_stock' ? storageLocation : undefined, notes, items, createdBy: req.user._id }, returnNumber);
  if (!record) return res.status(409).json({ error: { message: 'Unable to generate a unique return number. Please try again.' } });

  try {
    if (disposition === 'return_stock') {
      const products = await ReturnProduct.create(items.map((item) => ({ ...item, returnRecord: record._id, client, sourceSite, storageLocation, status: 'stored', createdBy: req.user._id })));
      record.products = products.map((product) => product._id);
      await record.save();
    } else {
      const challan = await createWithNumber(Challan, {
        client,
        sourceSite,
        site: destinationSite,
        returnRecord: record._id,
        transferType: 'return_transfer',
        challanDate: pickupDate,
        lineItems: items.map((item) => ({ ...item, rate: 0, amount: 0 })),
        taxableAmount: 0,
        totalAmount: 0,
      }, challanNumber);
      if (!challan) throw Object.assign(new Error('Unable to generate a unique challan number. Please try again.'), { statusCode: 409 });
      record.challan = challan._id;
      await record.save();
      const products = await ReturnProduct.create(items.map((item) => ({ ...item, returnRecord: record._id, client, sourceSite, status: 'transferred', createdBy: req.user._id })));
      record.products = products.map((product) => product._id);
      await record.save();
    }
  } catch (error) {
    await Promise.all([ReturnProduct.deleteMany({ returnRecord: record._id }), Challan.deleteMany({ returnRecord: record._id })]);
    await record.deleteOne();
    throw error;
  }

  await auditEvent(req, { action: 'return.create', entity: 'return_record', entityId: record._id, after: record.toObject() });
  return res.status(201).json({ data: record });
}

export async function listReturns(req, res) {
  const { page, limit } = pageParams(req.query);
  const query = {};
  if (isId(req.query.client)) query.client = req.query.client;
  if (req.query.disposition === 'return_stock' || req.query.disposition === 'site_transfer') query.disposition = req.query.disposition;
  if (String(req.query.q || '').trim()) query.returnNumber = { $regex: String(req.query.q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  const [data, total] = await Promise.all([
    ReturnRecord.find(query).populate('client', 'name').populate('sourceSite', 'name siteName siteAddress').populate('destinationSite', 'name siteName siteAddress').populate('challan', 'challanNumber').sort({ pickupDate: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    ReturnRecord.countDocuments(query),
  ]);
  return res.json({ data, meta: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) } });
}

export async function listReturnProducts(req, res) {
  const { page, limit } = pageParams(req.query);
  const query = {};
  if (isId(req.query.client)) query.client = req.query.client;
  if (req.query.status === 'stored' || req.query.status === 'transferred') query.status = req.query.status;
  if (String(req.query.q || '').trim()) query.name = { $regex: String(req.query.q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  const [data, total] = await Promise.all([
    ReturnProduct.find(query).populate('client', 'name').populate('sourceSite', 'name siteName siteAddress').populate('returnRecord', 'returnNumber').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    ReturnProduct.countDocuments(query),
  ]);
  return res.json({ data, meta: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) } });
}
