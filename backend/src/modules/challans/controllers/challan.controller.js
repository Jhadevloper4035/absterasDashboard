import { randomUUID } from 'node:crypto';
import { auditEvent } from '../../../services/audit.service.js';
import { Client } from '../../clients/models/client.model.js';
import { Challan } from '../models/challan.model.js';
import { createChallanPdf } from '../services/challan-pdf.service.js';
import { DEFAULT_HSN_CODE, InventoryItem } from '../../inventory/models/item.model.js';
import { StockTransaction } from '../../inventory/models/transaction.model.js';
import { ReturnProduct } from '../../returns/models/return-product.model.js';
import { LaserCutChallan } from '../../lasercut/models.js';
import { PowderCoatChallan } from '../../powdercoating/models.js';

const FIELDS = ['client', 'site', 'supplier', 'challanDate', 'pickupAddress', 'transportType', 'vehicleNumber', 'eWayBillNumber', 'lineItems', 'linkedInvoice', 'pdfFileUrl'];
const payload = (body) => FIELDS.reduce((result, field) => (body?.[field] !== undefined ? { ...result, [field]: body[field] } : result), {});
const required = (body) => ['client', 'challanDate'].every((field) => body?.[field] !== undefined && String(body[field]).trim() !== '');
const challanNumber = () => `DC-${randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()}`;
const requestedChallanNumber = (value) => /^DC-[A-F0-9]{10}$/.test(String(value || '')) ? value : undefined;

const clientSnapshot = (clientRef, clientName) => clientRef ? { _id: String(clientRef), name: clientName || 'Client' } : undefined;
const centralChallan = (challan) => ({
  _id: String(challan._id), challanNumber: challan.challanNumber, challanDate: challan.challanDate,
  createdAt: challan.createdAt,
  transferType: challan.transferType, process: challan.transferType === 'return_transfer' ? 'Return Management' : 'Inventory Delivery',
  client: challan.client ? { _id: String(challan.client._id), name: challan.client.name } : undefined,
  siteName: challan.site?.siteName || challan.site?.name, counterpartyName: challan.supplier?.name,
  itemCount: challan.lineItems?.length || challan.returnProducts?.length || 0, workflowLink: `/challans/${challan._id}`, pdfPath: `/challans/${challan._id}/pdf`, isCentralChallan: true,
});
const laserCutChallan = (challan) => ({
  _id: String(challan._id), challanNumber: challan.challanNo, challanDate: challan.challanDate,
  createdAt: challan.createdAt,
  transferType: challan.type === 'OUT' ? 'inventory_to_laser_cut' : 'laser_cut_return', process: 'Laser Cut',
  client: clientSnapshot(challan.clientRef, challan.clientName), siteName: challan.clientSiteName, counterpartyName: challan.vendorName,
  itemCount: challan.items?.length || 0, workflowLink: challan.orderRef ? `/laser-cut-management/orders/${challan.orderRef}` : '/laser-cut-management/orders', pdfPath: `/challans/laser-cut/${challan._id}/pdf`, isCentralChallan: false,
});
const powderCoatingChallan = (challan) => ({
  _id: String(challan._id), challanNumber: challan.challanNo, challanDate: challan.challanDate,
  createdAt: challan.createdAt,
  transferType: challan.type === 'SITE_OUT' ? 'powder_coating_to_client' : challan.type === 'OUT' && challan.items?.some((item) => item.source === 'LASER_CUT') ? 'laser_cut_to_powder_coating' : challan.type === 'OUT' ? 'inventory_to_powder_coating' : 'powder_coating_return', process: 'Powder Coating',
  client: clientSnapshot(challan.clientRef, challan.clientName), siteName: challan.clientSiteName, counterpartyName: challan.vendorName,
  itemCount: challan.items?.length || 0, workflowLink: challan.orderRef ? `/powder-coating-management/orders/${challan.orderRef}` : '/powder-coating-management/orders', pdfPath: `/challans/powder-coating/${challan._id}/pdf`, isCentralChallan: false,
});

export function processChallanForPdf(challan) {
  return {
    challanNumber: challan.challanNo,
    challanDate: challan.challanDate,
    client: { name: challan.clientName || 'Client', shippingAddress: challan.clientSiteAddressSnapshot },
    site: { siteAddress: challan.clientSiteAddressSnapshot },
    supplier: { name: challan.vendorName, address: challan.vendorAddressSnapshot },
    pickupAddress: challan.type === 'SITE_OUT' ? challan.vendorAddressSnapshot : challan.items?.[0]?.pickupAddressSnapshot || challan.vendorAddressSnapshot,
    transportType: challan.transportType,
    vehicleNumber: challan.vehicleNumber,
    eWayBillNumber: challan.eWayBillNumber,
    lineItems: (challan.items || []).map((item) => ({ description: item.itemName, hsnCode: item.hsnCode, quantity: item.quantity, unit: item.unit })),
  };
}

export function inventoryLineFor(material, line) {
  const quantity = Number(line?.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) throw Object.assign(new Error('Item quantity must be greater than zero'), { statusCode: 400 });
  return { inventoryItem: material._id, description: material.name, hsnCode: material.hsnCode || DEFAULT_HSN_CODE, quantity, unit: material.unit };
}

async function inventoryLines(lines, hardwareOnly = false) {
  if (!Array.isArray(lines) || !lines.length || lines.some((line) => !line?.inventoryItem)) throw Object.assign(new Error('Select at least one inventory material'), { statusCode: 400 });
  const items = await InventoryItem.find({ _id: { $in: lines.map((line) => line.inventoryItem) }, status: 'active' }).lean();
  const byId = new Map(items.map((item) => [String(item._id), item]));
  return lines.map((line) => {
    const material = byId.get(String(line.inventoryItem));
    if (!material) throw Object.assign(new Error('Inventory material not found or inactive'), { statusCode: 400 });
    if (hardwareOnly && material.category !== 'hardware') throw Object.assign(new Error(`${material.name} is not a hardware item`), { statusCode: 400 });
    return inventoryLineFor(material, line);
  });
}

export async function createChallan(req, res) {
  if (!required(req.body)) return res.status(400).json({ error: { message: 'Client and date are required' } });
  let challan; const values = payload(req.body); const requestedNumber = requestedChallanNumber(req.body?.challanNumber);
  values.lineItems = await inventoryLines(values.lineItems, req.body?.hardwareOnly === true);
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
  const type = String(req.query.type || '').trim();
  const types = ['delivery', 'return_transfer', 'inventory_to_laser_cut', 'laser_cut_return', 'inventory_to_powder_coating', 'laser_cut_to_powder_coating', 'powder_coating_to_client', 'powder_coating_return'];
  if (type && !types.includes(type)) return res.status(400).json({ error: { message: 'Invalid challan type' } });
  const standardQuery = {};
  const laserQuery = {};
  const powderQuery = {};
  if (req.query.client) { standardQuery.client = req.query.client; laserQuery.clientRef = req.query.client; powderQuery.clientRef = req.query.client; }
  if (req.query.site) { standardQuery.site = req.query.site; laserQuery.clientSiteRef = req.query.site; powderQuery.clientSiteRef = req.query.site; }
  if (type === 'delivery' || type === 'return_transfer') standardQuery.transferType = type;
  const [standard, laserCut, powderCoating] = await Promise.all([
    Challan.find(standardQuery).populate('client', 'name siteName').populate('site', 'name siteName siteAddress').populate('supplier', 'name').lean(),
    LaserCutChallan.find(laserQuery).lean(),
    PowderCoatChallan.find(powderQuery).lean(),
  ]);
  const matchesSearch = (challan) => !search || challan.challanNumber.toLowerCase().includes(search.toLowerCase());
  const newestFirst = (challan) => new Date(challan.createdAt || challan.challanDate).getTime();
  const challengers = [...standard.map(centralChallan), ...laserCut.map(laserCutChallan), ...powderCoating.map(powderCoatingChallan)]
    .filter((challan) => (!type || challan.transferType === type) && matchesSearch(challan))
    .sort((first, second) => newestFirst(second) - newestFirst(first));
  const total = challengers.length;
  return res.json({ data: challengers.slice((page - 1) * limit, page * limit), meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } });
}

export async function getChallan(req, res) {
  const challan = await Challan.findById(req.params.id).populate('client', 'name gstin phone billingAddress shippingAddress state stateCode').populate('site', 'name siteName siteAddress shippingAddress state stateCode').populate('supplier', 'name address');
  if (!challan) return res.status(404).json({ error: { message: 'Challan not found' } });
  return res.json({ data: challan });
}

export async function downloadChallanPdf(req, res) {
  const challan = await Challan.findById(req.params.id).populate('client', 'name gstin phone billingAddress shippingAddress state stateCode').populate('site', 'name siteName siteAddress shippingAddress state stateCode').populate('supplier', 'name address');
  if (!challan) return res.status(404).json({ error: { message: 'Challan not found' } });
  const pdf = await createChallanPdf(challan);
  const filename = `challan-${challan.challanNumber.replace(/[^\w-]/g, '_')}.pdf`;
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${filename}"` });
  return res.send(pdf);
}

export async function downloadProcessChallanPdf(req, res) {
  const model = req.params.process === 'laser-cut' ? LaserCutChallan : req.params.process === 'powder-coating' ? PowderCoatChallan : null;
  if (!model) return res.status(400).json({ error: { message: 'Invalid challan process' } });
  const challan = await model.findById(req.params.id).lean();
  if (!challan) return res.status(404).json({ error: { message: 'Challan not found' } });
  const pdf = await createChallanPdf(processChallanForPdf(challan));
  const filename = `challan-${String(challan.challanNo).replace(/[^\w-]/g, '_')}.pdf`;
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${filename}"` });
  return res.send(pdf);
}

export async function updateChallan(req, res) {
  const challan = await Challan.findById(req.params.id);
  if (!challan) return res.status(404).json({ error: { message: 'Challan not found' } });
  if (challan.transferType === 'return_transfer') return res.status(409).json({ error: { message: 'Return transfer challans cannot be edited because their quantities are linked to return storage' } });
  const values = payload(req.body);
  if (values.lineItems !== undefined) return res.status(409).json({ error: { message: 'Challan items cannot be changed after inventory stock is transferred' } });
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
    if (challan.transferType === 'return_transfer') {
      for (const line of challan.returnProducts || []) {
        const product = await ReturnProduct.findByIdAndUpdate(line.product, { $inc: { quantity: Number(line.quantity) }, $set: { status: 'stored' } });
        if (!product) throw new Error('Return product no longer exists');
        restored.push({ product: line.product, quantity: Number(line.quantity) });
      }
    } else {
      for (const line of (challan.lineItems || []).filter((entry) => entry.inventoryItem)) {
        const quantity = Number(line.quantity);
        const item = await InventoryItem.findByIdAndUpdate(line.inventoryItem, { $inc: { quantityInStock: quantity } });
        if (!item) throw new Error(`Inventory item no longer exists for ${line.description}`);
        restored.push({ item: line.inventoryItem, quantity });
        const transaction = await StockTransaction.create({ item: line.inventoryItem, type: 'adjustment', quantity, reference: challan.challanNumber, note: `Stock restored after deleting delivery challan ${challan.challanNumber}`, purchaseDate: new Date(), performedBy: req.user._id });
        if (transaction?._id) stockTransactions.push(transaction._id);
      }
    }
    await challan.deleteOne();
  } catch (error) {
    await Promise.all(restored.map(({ item, product, quantity }) => item ? InventoryItem.findByIdAndUpdate(item, { $inc: { quantityInStock: -quantity } }) : ReturnProduct.findByIdAndUpdate(product, { $inc: { quantity: -quantity } })));
    if (stockTransactions.length) await StockTransaction.deleteMany({ _id: { $in: stockTransactions } });
    throw error;
  }
  await auditEvent(req, { action: 'challan.delete', entity: 'challan', entityId: challan._id, before: challan.toObject() });
  return res.status(204).end();
}
