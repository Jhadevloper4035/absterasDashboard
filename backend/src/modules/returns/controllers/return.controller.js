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

function transferItems(items) {
  if (!Array.isArray(items) || !items.length) return null;
  const seen = new Set();
  const result = items.map((item) => {
    const returnProduct = String(item?.returnProduct || '');
    const quantity = Number(item?.quantity);
    if (returnProduct) return { returnProduct, quantity };
    return { name: String(item?.name || '').trim(), unit: String(item?.unit || '').trim(), quantity };
  });
  if (!result.every((item) => (item.returnProduct ? isId(item.returnProduct) : item.name && item.unit) && Number.isFinite(item.quantity) && item.quantity > 0)) return null;
  for (const item of result) {
    if (!item.returnProduct) continue;
    if (seen.has(item.returnProduct)) return null;
    seen.add(item.returnProduct);
  }
  return result;
}

async function validSite(client, site) {
  return isId(site) && Client.exists({ _id: site, parentClient: client });
}

async function clientForSite(site) {
  if (!isId(site)) return null;
  const destinationSite = await Client.findOne({ _id: site, parentClient: { $ne: null } }).select('parentClient').lean();
  return destinationSite?.parentClient || null;
}

async function createWithNumber(Model, values, nextNumber) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try { return await Model.create({ ...values, [Model === ReturnRecord ? 'returnNumber' : 'challanNumber']: nextNumber() }); }
    catch (error) { if (error?.code !== 11000) throw error; }
  }
  return null;
}

export async function createReturn(req, res) {
  const { client, sourceSite, pickupDate, storageLocation, notes } = req.body || {};
  const items = returnItems(req.body?.items);
  if (req.body?.destinationSite) return res.status(400).json({ error: { message: 'Store the return first, then create a return transfer challan' } });
  if (!isId(client) || !await Client.exists({ _id: client, parentClient: null })) return res.status(400).json({ error: { message: 'Select a valid client' } });
  if (!await validSite(client, sourceSite)) return res.status(400).json({ error: { message: 'Select a pickup site belonging to the selected client' } });
  if (!items) return res.status(400).json({ error: { message: 'Add at least one returned material with quantity and unit' } });
  if (!pickupDate || Number.isNaN(Date.parse(pickupDate))) return res.status(400).json({ error: { message: 'Pickup date is required' } });

  const record = await createWithNumber(ReturnRecord, { client, sourceSite, pickupDate, disposition: 'return_stock', storageLocation, notes, items, createdBy: req.user._id }, returnNumber);
  if (!record) return res.status(409).json({ error: { message: 'Unable to generate a unique return number. Please try again.' } });

  try {
    const products = await ReturnProduct.create(items.map((item) => ({ ...item, returnRecord: record._id, client, sourceSite, storageLocation, status: 'stored', createdBy: req.user._id })));
    record.products = products.map((product) => product._id);
    await record.save();
  } catch (error) {
    await Promise.all([ReturnProduct.deleteMany({ returnRecord: record._id }), Challan.deleteMany({ returnRecord: record._id })]);
    await record.deleteOne();
    throw error;
  }

  await auditEvent(req, { action: 'return.create', entity: 'return_record', entityId: record._id, after: record.toObject() });
  return res.status(201).json({ data: record });
}

export async function createReturnTransfer(req, res) {
  const { sourceSite, destinationSite, challanDate, transportType, vehicleNumber, eWayBillNumber } = req.body || {};
  const items = transferItems(req.body?.items);
  if (!isId(sourceSite)) return res.status(400).json({ error: { message: 'Select a pickup site' } });
  if (!isId(destinationSite) || String(destinationSite) === String(sourceSite)) return res.status(400).json({ error: { message: 'Select a different destination site' } });
  if (!items) return res.status(400).json({ error: { message: 'Add a stored or custom product with quantity and unit' } });
  if (!challanDate || Number.isNaN(Date.parse(challanDate))) return res.status(400).json({ error: { message: 'Challan date is required' } });

  const sourceClient = await clientForSite(sourceSite);
  if (!sourceClient) return res.status(400).json({ error: { message: 'Select a valid pickup site' } });
  const destinationClient = await clientForSite(destinationSite);
  if (!destinationClient) return res.status(400).json({ error: { message: 'Select a valid destination site' } });

  const storedItems = items.filter((item) => item.returnProduct);
  const products = storedItems.length ? await ReturnProduct.find({ _id: { $in: storedItems.map((item) => item.returnProduct) }, sourceSite, status: 'stored' }).lean() : [];
  if (products.length !== storedItems.length) return res.status(400).json({ error: { message: 'One or more selected materials are no longer in return storage' } });
  if (products.some((product) => String(product.client) !== String(sourceClient))) return res.status(400).json({ error: { message: 'Stored materials must belong to the selected pickup site' } });

  const productById = new Map(products.map((product) => [String(product._id), product]));
  if (storedItems.some((item) => item.quantity > Number(productById.get(item.returnProduct)?.quantity || 0))) return res.status(409).json({ error: { message: 'Transfer quantity cannot exceed material in return storage' } });

  const challan = await createWithNumber(Challan, {
    client: destinationClient,
    sourceSite,
    site: destinationSite,
    transferType: 'return_transfer',
    returnProducts: storedItems.map((item) => ({ product: item.returnProduct, quantity: item.quantity })),
    challanDate,
    transportType,
    vehicleNumber,
    eWayBillNumber,
    lineItems: items.map((item) => {
      const product = productById.get(item.returnProduct);
      return { description: product?.name || item.name, quantity: item.quantity, unit: product?.unit || item.unit, rate: 0, amount: 0 };
    }),
    taxableAmount: 0,
    totalAmount: 0,
  }, challanNumber);
  if (!challan) return res.status(409).json({ error: { message: 'Unable to generate a unique challan number. Please try again.' } });

  const deducted = [];
  try {
    for (const item of storedItems) {
      const product = await ReturnProduct.findOneAndUpdate({ _id: item.returnProduct, sourceSite, client: sourceClient, status: 'stored', quantity: { $gte: item.quantity } }, { $inc: { quantity: -item.quantity } }, { new: true });
      if (!product) throw Object.assign(new Error('A selected material no longer has enough quantity in return storage'), { statusCode: 409 });
      deducted.push(item);
      if (Number(product.quantity) === 0) await ReturnProduct.findByIdAndUpdate(product._id, { $set: { status: 'transferred' } });
    }
  } catch (error) {
    await Promise.all(deducted.map((item) => ReturnProduct.findByIdAndUpdate(item.returnProduct, { $inc: { quantity: item.quantity }, $set: { status: 'stored' } })));
    await challan.deleteOne();
    throw error;
  }

  await auditEvent(req, { action: 'return.transfer', entity: 'challan', entityId: challan._id, after: challan.toObject() });
  return res.status(201).json({ data: challan });
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

export async function listReturnTransfers(req, res) {
  const { page, limit } = pageParams(req.query);
  const [data, total] = await Promise.all([
    Challan.find({ transferType: 'return_transfer' }).populate('client', 'name').populate('sourceSite', 'name siteName siteAddress').populate('site', 'name siteName siteAddress').sort({ challanDate: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Challan.countDocuments({ transferType: 'return_transfer' }),
  ]);
  return res.json({ data, meta: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) } });
}
