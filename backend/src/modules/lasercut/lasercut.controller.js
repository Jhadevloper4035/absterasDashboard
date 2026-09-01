import mongoose from 'mongoose';
import { DEFAULT_HSN_CODE, InventoryItem, laserCutMaterialDetails } from '../inventory/models/item.model.js';
import { Client } from '../clients/models/client.model.js';
import { Supplier } from '../inventory/models/supplier.model.js';
import { StockTransaction } from '../inventory/models/transaction.model.js';
import { LaserCutAudit, LaserCutChallan, LaserCutOrder, LaserCutStock, LaserCutUsage, LaserCutVendor } from './models.js';

const badRequest = (message) => Object.assign(new Error(message), { statusCode: 400 });
const conflict = (message) => Object.assign(new Error(message), { statusCode: 409 });
const missing = (message) => Object.assign(new Error(message), { statusCode: 404 });
const validId = (value) => mongoose.isObjectIdOrHexString(value);
const number = (value) => Number(value);
const round = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
const plain = (value) => value?.toObject ? value.toObject() : value;
const vendorFields = ['name', 'contactPerson', 'phone', 'email', 'address', 'notes', 'status'];
const vendorPayload = (body) => Object.fromEntries(vendorFields.filter((field) => body?.[field] !== undefined).map((field) => [field, body[field]]));
export const LASER_CUT_DROP_ADDRESS = 'PLOT NO -A-1140 SUSHANT LOK-1, GURUGRAM, HARYANA';

function dimensionsFor(materialType, values = {}) {
  const dimensions = { heightFt: number(values.heightFt), widthFt: number(values.widthFt), lengthFt: number(values.lengthFt) };
  if (materialType === 'SHEET' && (!Number.isFinite(dimensions.heightFt) || dimensions.heightFt <= 0 || !Number.isFinite(dimensions.widthFt) || dimensions.widthFt <= 0)) throw badRequest('Sheet height and width must be greater than zero');
  if (materialType === 'TUBE' && (!Number.isFinite(dimensions.lengthFt) || dimensions.lengthFt <= 0)) throw badRequest('Tube length must be greater than zero');
  return Object.fromEntries(Object.entries(dimensions).filter(([, value]) => Number.isFinite(value)));
}

function materialKey(materialType, dimensions, inventoryItemRef) {
  if (materialType === 'OTHER') return `PRODUCT-${inventoryItemRef}`;
  return materialType === 'SHEET' ? `SHEET-${dimensions.heightFt}x${dimensions.widthFt}` : `TUBE-${dimensions.lengthFt}`;
}

export function orderStatus(order) {
  const expected = order.expected || {}; const sent = order.sent || {};
  const remainingSheets = Math.max(number(expected.sheets) - number(sent.sheets), 0);
  const remainingTubes = Math.max(number(expected.tubes) - number(sent.tubes), 0);
  const expectedTotal = number(expected.sheets) + number(expected.tubes);
  const sentTotal = number(sent.sheets) + number(sent.tubes);
  return { remainingSheets: round(remainingSheets), remainingTubes: round(remainingTubes), status: expectedTotal === 0 && sentTotal === 0 ? 'PENDING' : remainingSheets || remainingTubes ? 'PARTIAL' : 'COMPLETE' };
}

function orderView(order) { return { ...plain(order), ...orderStatus(order) }; }

async function ordersWithClientNames(orders) {
  const clientIds = orders.map((order) => order.customerRef).filter(validId);
  const clients = clientIds.length ? await Client.find({ _id: { $in: clientIds } }).select('name').lean() : [];
  const clientNames = new Map(clients.map((client) => [String(client._id), client.name]));
  return orders.map((order) => ({ ...orderView(order), clientName: clientNames.get(String(order.customerRef)) || '—' }));
}

async function writeAudit({ session, entityType, entityId, action, performedBy, before, after, metadata }) {
  await LaserCutAudit.create([{ entityType, entityId: String(entityId), action, performedBy, before, after, metadata }], { session });
}

export async function normalizedItems(items) {
  if (!Array.isArray(items) || !items.length) throw badRequest('At least one material is required');
  if (items.some((item) => !validId(item?.inventoryItemRef))) throw badRequest('Invalid inventory material');
  const materials = await InventoryItem.find({ _id: { $in: items.map((item) => item.inventoryItemRef) }, status: 'active' }).lean();
  const supplierIds = materials.map((material) => material.supplier).filter(validId);
  const suppliers = supplierIds.length ? await Supplier.find({ _id: { $in: supplierIds }, status: 'active' }).lean() : [];
  const byId = new Map(materials.map((item) => [String(item._id), item]));
  const supplierById = new Map(suppliers.map((supplier) => [String(supplier._id), supplier]));
  return items.map((item) => {
    const material = byId.get(String(item.inventoryItemRef));
    if (!material) throw missing('Inventory material not found');
    const quantity = number(item.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) throw badRequest('Material quantity must be greater than zero');
    const { materialType, defaultDimensions } = laserCutMaterialDetails(material);
    const dimensions = ['SHEET', 'TUBE'].includes(materialType) ? dimensionsFor(materialType, defaultDimensions) : undefined;
    const pickupSupplier = supplierById.get(String(material.supplier));
    return { inventoryItemRef: material._id, itemName: material.name, hsnCode: String(material.hsnCode || DEFAULT_HSN_CODE), unit: material.unit, pickupSupplierRef: pickupSupplier?._id, pickupSupplierName: pickupSupplier?.name, pickupAddressSnapshot: pickupSupplier?.address, materialType, quantity: round(quantity), dimensions };
  });
}

export async function listVendors(req, res) { return res.json({ data: await LaserCutVendor.find(req.query.status ? { status: req.query.status } : {}).sort({ name: 1 }).lean() }); }
export async function createVendor(req, res) { const vendor = await LaserCutVendor.create(vendorPayload(req.body)); return res.status(201).json({ data: vendor }); }
export async function updateVendor(req, res) { if (!validId(req.params.id)) throw badRequest('Invalid laser-cut vendor'); const vendor = await LaserCutVendor.findByIdAndUpdate(req.params.id, vendorPayload(req.body), { new: true, runValidators: true }); if (!vendor) throw missing('Laser-cut vendor not found'); return res.json({ data: vendor }); }
export async function deleteVendor(req, res) { if (!validId(req.params.id)) throw badRequest('Invalid laser-cut vendor'); const vendor = await LaserCutVendor.findByIdAndUpdate(req.params.id, { status: 'inactive' }, { new: true, runValidators: true }); if (!vendor) throw missing('Laser-cut vendor not found'); return res.json({ data: vendor }); }

function orderIncrement(items) {
  return items.reduce((totals, item) => {
    const field = item.materialType === 'SHEET' ? 'sheets' : item.materialType === 'TUBE' ? 'tubes' : undefined;
    return field ? { ...totals, [field]: round(totals[field] + item.quantity) } : totals;
  }, { sheets: 0, tubes: 0 });
}

export async function listOrders(req, res) {
  const orders = await LaserCutOrder.find().sort({ createdAt: -1 }).lean();
  return res.json({ data: await ordersWithClientNames(orders) });
}

export async function createOrder(req, res) {
  const name = String(req.body?.orderName || '').trim();
  const expected = { sheets: number(req.body?.expected?.sheets || 0), tubes: number(req.body?.expected?.tubes || 0) };
  if (Object.values(expected).some((value) => !Number.isFinite(value) || value < 0)) throw badRequest('Expected quantities must be zero or greater');
  const panelSpec = req.body?.panelSpec?.panelAreaSqFt === undefined ? undefined : { count: number(req.body.panelSpec.count || 0), panelAreaSqFt: number(req.body.panelSpec.panelAreaSqFt) };
  if (panelSpec && (!Number.isFinite(panelSpec.count) || panelSpec.count < 0 || !Number.isFinite(panelSpec.panelAreaSqFt) || panelSpec.panelAreaSqFt <= 0)) throw badRequest('Panel specification must be valid');
  const order = new LaserCutOrder({ customerRef: String(req.body?.customerRef || '').trim() || undefined, expected, panelSpec });
  order.orderName = name || String(order._id);
  order.status = orderStatus(order).status; await order.save();
  await writeAudit({ entityType: 'ORDER', entityId: order._id, action: 'CREATE', performedBy: req.user._id, after: plain(order) });
  return res.status(201).json({ data: orderView(order) });
}

export async function updateOrder(req, res) {
  if (!validId(req.params.id)) throw badRequest('Invalid order id');
  const order = await LaserCutOrder.findById(req.params.id);
  if (!order) throw missing('Order not found');
  const before = plain(order);
  if (req.body.orderName !== undefined) { const name = String(req.body.orderName).trim(); if (!name) throw badRequest('Order name is required'); order.orderName = name; }
  if (req.body.customerRef !== undefined) order.customerRef = String(req.body.customerRef || '').trim();
  if (req.body.expected !== undefined) {
    const expected = { sheets: number(req.body.expected.sheets || 0), tubes: number(req.body.expected.tubes || 0) };
    if (Object.values(expected).some((value) => !Number.isFinite(value) || value < 0)) throw badRequest('Expected quantities must be zero or greater');
    order.expected = expected;
  }
  if (req.body.panelSpec !== undefined) order.panelSpec = req.body.panelSpec?.panelAreaSqFt ? { count: number(req.body.panelSpec.count || 0), panelAreaSqFt: number(req.body.panelSpec.panelAreaSqFt) } : undefined;
  order.status = orderStatus(order).status; await order.save();
  await writeAudit({ entityType: 'ORDER', entityId: order._id, action: 'UPDATE', performedBy: req.user._id, before, after: plain(order) });
  return res.json({ data: orderView(order) });
}

export async function deleteOrder(req, res) {
  if (!validId(req.params.id)) throw badRequest('Invalid order id');
  const session = await mongoose.startSession();
  let restoredItems = 0;
  try {
    await session.withTransaction(async () => {
      const order = await LaserCutOrder.findById(req.params.id).session(session);
      if (!order) throw missing('Order not found');
      const [challans, usage] = await Promise.all([
        LaserCutChallan.find({ orderRef: order._id }).session(session),
        LaserCutUsage.exists({ orderRef: order._id }).session(session),
      ]);
      if (usage) throw conflict('Orders with recorded laser-cut usage cannot be deleted');
      if (challans.some((challan) => challan.type !== 'OUT' || !['DRAFT', 'DISPATCHED'].includes(challan.status))) throw conflict('Orders with returned materials cannot be deleted');

      for (const challan of challans.filter((entry) => entry.status === 'DISPATCHED')) {
        for (const item of challan.items) {
          const key = materialKey(item.materialType, item.dimensions || {}, item.inventoryItemRef);
          const stock = await LaserCutStock.findOneAndUpdate({ vendorRef: challan.vendorRef, materialKey: key, quantityAvailable: { $gte: item.quantity } }, { $inc: { quantityAvailable: -item.quantity } }, { new: true, session });
          if (!stock) throw conflict(`Vendor stock is insufficient to return ${item.itemName} to inventory`);
          const material = await InventoryItem.findByIdAndUpdate(item.inventoryItemRef, { $inc: { quantityInStock: item.quantity } }, { new: true, session });
          if (!material) throw missing(`Inventory product not found for ${item.itemName}`);
          await StockTransaction.create([{ item: material._id, type: 'in', quantity: item.quantity, reference: challan.challanNo, note: `Stock restored after deleting laser-cut order ${order.orderName}`, performedBy: req.user._id }], { session });
          await writeAudit({ session, entityType: 'LASER_CUT_STOCK', entityId: stock._id, action: 'ORDER_DELETE_RESTORE', performedBy: req.user._id, after: plain(stock), metadata: { challanNo: challan.challanNo, orderId: String(order._id) } });
          restoredItems += 1;
        }
      }

      await writeAudit({ session, entityType: 'ORDER', entityId: order._id, action: 'DELETE', performedBy: req.user._id, before: plain(order), metadata: { restoredItems, challanCount: challans.length } });
      await LaserCutChallan.deleteMany({ orderRef: order._id }).session(session);
      await order.deleteOne({ session });
    });
  } finally { await session.endSession(); }
  return res.json({ data: { restoredItems } });
}

export async function getOrder(req, res) {
  if (!validId(req.params.id)) throw badRequest('Invalid order id');
  const order = await LaserCutOrder.findById(req.params.id).lean();
  if (!order) throw missing('Order not found');
  const [challans, client] = await Promise.all([
    LaserCutChallan.find({ orderRef: order._id }).sort({ createdAt: -1 }).lean(),
    validId(order.customerRef) ? Client.findById(order.customerRef).select('name gstin billingAddress shippingAddress state stateCode phone email').lean() : null,
  ]);
  return res.json({ data: { ...orderView(order), clientName: client?.name || '—', client: client || undefined, challans } });
}

export async function listChallans(req, res) {
  const query = {};
  if (req.query.type && ['OUT', 'IN'].includes(req.query.type)) query.type = req.query.type;
  if (req.query.vendor && validId(req.query.vendor)) query.vendorRef = req.query.vendor;
  if (req.query.order && validId(req.query.order)) query.orderRef = req.query.order;
  return res.json({ data: await LaserCutChallan.find(query).sort({ createdAt: -1 }).lean() });
}

export async function createChallan(req, res) {
  const type = req.body?.type;
  if (!['OUT', 'IN'].includes(type) || !validId(req.body?.vendorRef)) throw badRequest('A valid challan type and vendor are required');
  if (type === 'OUT' && !validId(req.body?.clientRef)) throw badRequest('A valid parent client is required');
  if (req.body.clientSiteRef && !validId(req.body.clientSiteRef)) throw badRequest('Invalid child client site');
  if (req.body.orderRef && !validId(req.body.orderRef)) throw badRequest('Invalid order');
  const [vendor, client, clientSite, order, items] = await Promise.all([LaserCutVendor.findOne({ _id: req.body.vendorRef, status: 'active' }).lean(), req.body.clientRef ? Client.findOne({ _id: req.body.clientRef, parentClient: null }).lean() : null, req.body.clientSiteRef ? Client.findOne({ _id: req.body.clientSiteRef, parentClient: req.body.clientRef }).lean() : null, req.body.orderRef ? LaserCutOrder.findById(req.body.orderRef).lean() : null, normalizedItems(req.body.items)]);
  if (!vendor) throw missing('Active vendor not found');
  if (type === 'OUT' && !client) throw missing('Parent client not found');
  if (req.body.clientSiteRef && !clientSite) throw missing('Child client site not found');
  if (req.body.orderRef && !order) throw missing('Order not found');
  const challan = await LaserCutChallan.create({ challanNo: `LC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`, type, challanDate: req.body.challanDate || undefined, clientRef: client?._id, clientName: client?.name, clientSiteRef: clientSite?._id, clientSiteName: clientSite?.siteName || clientSite?.name, clientSiteAddressSnapshot: clientSite?.siteAddress || clientSite?.shippingAddress || clientSite?.billingAddress, deliveryAddress: LASER_CUT_DROP_ADDRESS, vendorRef: vendor._id, vendorName: vendor.name, vendorAddressSnapshot: String(vendor.address || '').trim() || undefined, transportType: String(req.body.transportType || '').trim() || undefined, vehicleNumber: String(req.body.vehicleNumber || '').trim() || undefined, eWayBillNumber: String(req.body.eWayBillNumber || '').trim() || undefined, orderRef: order?._id, items, createdBy: req.user._id });
  await writeAudit({ entityType: 'CHALLAN', entityId: challan._id, action: 'CREATE', performedBy: req.user._id, after: plain(challan), metadata: { challanNo: challan.challanNo, vendorName: vendor.name } });
  return res.status(201).json({ data: challan });
}

export async function dispatchChallan(req, res) {
  if (!validId(req.params.id)) throw badRequest('Invalid challan id');
  const session = await mongoose.startSession(); let dispatched;
  try {
    await session.withTransaction(async () => {
      const challan = await LaserCutChallan.findOne({ _id: req.params.id, type: 'OUT', status: 'DRAFT' }).session(session);
      if (!challan) throw conflict('Only draft outward challans can be dispatched');
      const before = plain(challan);
      for (const item of challan.items) {
        const material = await InventoryItem.findOneAndUpdate({ _id: item.inventoryItemRef, quantityInStock: { $gte: item.quantity } }, { $inc: { quantityInStock: -item.quantity } }, { new: true, session });
        if (!material) throw conflict(`Insufficient stock for ${item.itemName}`);
        await StockTransaction.create([{ item: material._id, type: 'out', quantity: item.quantity, reference: challan.challanNo, note: `Laser cut outward challan ${challan.challanNo}`, performedBy: req.user._id }], { session });
        const key = materialKey(item.materialType, item.dimensions || {}, item.inventoryItemRef);
        const stockBefore = await LaserCutStock.findOne({ vendorRef: challan.vendorRef, materialKey: key }).session(session);
        const stock = await LaserCutStock.findOneAndUpdate({ vendorRef: challan.vendorRef, materialKey: key }, { $setOnInsert: { vendorName: challan.vendorName, inventoryItemRef: item.inventoryItemRef, itemName: item.itemName, hsnCode: item.hsnCode, unit: item.unit, materialType: item.materialType, dimensions: item.dimensions }, $inc: { quantityAvailable: item.quantity } }, { new: true, upsert: true, session });
        await writeAudit({ session, entityType: 'LASER_CUT_STOCK', entityId: stock._id, action: 'DISPATCH', performedBy: req.user._id, before: plain(stockBefore), after: plain(stock), metadata: { challanNo: challan.challanNo } });
      }
      if (challan.orderRef) {
        const totals = orderIncrement(challan.items);
        const order = await LaserCutOrder.findByIdAndUpdate(challan.orderRef, { $inc: { 'sent.sheets': totals.sheets, 'sent.tubes': totals.tubes } }, { new: true, session });
        order.status = orderStatus(order).status; await order.save({ session });
        await writeAudit({ session, entityType: 'ORDER', entityId: order._id, action: 'DISPATCH', performedBy: req.user._id, after: plain(order), metadata: { challanNo: challan.challanNo } });
      }
      challan.status = 'DISPATCHED'; challan.dispatchedAt = new Date(); await challan.save({ session });
      await writeAudit({ session, entityType: 'CHALLAN', entityId: challan._id, action: 'DISPATCH', performedBy: req.user._id, before, after: plain(challan) });
      dispatched = challan;
    });
  } finally { await session.endSession(); }
  return res.json({ data: dispatched });
}

export async function receiveChallan(req, res) {
  if (!validId(req.params.id)) throw badRequest('Invalid challan id');
  const session = await mongoose.startSession(); let received;
  try {
    await session.withTransaction(async () => {
      const challan = await LaserCutChallan.findOne({ _id: req.params.id, type: 'IN', status: 'DRAFT' }).session(session);
      if (!challan) throw conflict('Only draft inward challans can be received');
      const before = plain(challan);
      for (const item of challan.items) {
        const key = materialKey(item.materialType, item.dimensions || {}, item.inventoryItemRef);
        const stockBefore = await LaserCutStock.findOneAndUpdate({ vendorRef: challan.vendorRef, materialKey, quantityAvailable: { $gte: item.quantity } }, { $inc: { quantityAvailable: -item.quantity } }, { new: true, session });
        if (!stockBefore) throw conflict(`Vendor stock is insufficient for ${item.itemName}`);
        const material = await InventoryItem.findByIdAndUpdate(item.inventoryItemRef, { $inc: { quantityInStock: item.quantity } }, { new: true, session });
        await StockTransaction.create([{ item: material._id, type: 'in', quantity: item.quantity, reference: challan.challanNo, note: `Laser cut inward return ${challan.challanNo}`, performedBy: req.user._id }], { session });
        await writeAudit({ session, entityType: 'LASER_CUT_STOCK', entityId: stockBefore._id, action: 'RECEIVE', performedBy: req.user._id, after: plain(stockBefore), metadata: { challanNo: challan.challanNo } });
      }
      challan.status = 'RECEIVED'; challan.receivedAt = new Date(); await challan.save({ session });
      await writeAudit({ session, entityType: 'CHALLAN', entityId: challan._id, action: 'RECEIVE', performedBy: req.user._id, before, after: plain(challan) }); received = challan;
    });
  } finally { await session.endSession(); }
  return res.json({ data: received });
}

export async function listStock(req, res) {
  const query = req.query.vendor && validId(req.query.vendor) ? { vendorRef: req.query.vendor } : {};
  return res.json({ data: await LaserCutStock.find(query).sort({ vendorName: 1, materialType: 1 }).lean() });
}

export async function createUsage(req, res) {
  if (!validId(req.body?.vendorRef) || !validId(req.body?.orderRef) || !['SHEET', 'TUBE'].includes(req.body?.materialType)) throw badRequest('Vendor, order, and material type are required');
  const quantityConsumed = number(req.body.quantityConsumed); if (!Number.isFinite(quantityConsumed) || quantityConsumed <= 0) throw badRequest('Consumed quantity must be greater than zero');
  const dimensions = dimensionsFor(req.body.materialType, req.body.dimensions); const panelsProduced = number(req.body.panelsProduced || 0); if (!Number.isFinite(panelsProduced) || panelsProduced < 0) throw badRequest('Panels produced must be zero or greater');
  const session = await mongoose.startSession(); let usage;
  try {
    await session.withTransaction(async () => {
      const order = await LaserCutOrder.findById(req.body.orderRef).session(session); if (!order) throw missing('Order not found');
      const key = materialKey(req.body.materialType, dimensions);
      const stock = await LaserCutStock.findOneAndUpdate({ vendorRef: req.body.vendorRef, materialKey: key, quantityAvailable: { $gte: quantityConsumed } }, { $inc: { quantityAvailable: -quantityConsumed } }, { new: true, session });
      if (!stock) throw conflict('Vendor stock is insufficient for this usage entry');
      const panelArea = number(order.panelSpec?.panelAreaSqFt); const consumedArea = req.body.materialType === 'SHEET' ? quantityConsumed * dimensions.heightFt * dimensions.widthFt : undefined;
      const wastageAreaSqFt = consumedArea && Number.isFinite(panelArea) && panelArea > 0 ? round(Math.max(consumedArea - panelsProduced * panelArea, 0)) : undefined;
      const wastagePercent = wastageAreaSqFt === undefined ? undefined : round((wastageAreaSqFt / consumedArea) * 100);
      [usage] = await LaserCutUsage.create([{ vendorRef: req.body.vendorRef, orderRef: order._id, materialType: req.body.materialType, dimensions, quantityConsumed: round(quantityConsumed), panelsProduced, wastageAreaSqFt, wastagePercent, createdBy: req.user._id }], { session });
      await writeAudit({ session, entityType: 'LASER_CUT_STOCK', entityId: stock._id, action: 'USAGE_REPORTED', performedBy: req.user._id, after: plain(stock), metadata: { usageId: usage._id } });
      await writeAudit({ session, entityType: 'USAGE_ENTRY', entityId: usage._id, action: 'USAGE_REPORTED', performedBy: req.user._id, after: plain(usage) });
    });
  } finally { await session.endSession(); }
  return res.status(201).json({ data: usage });
}

export async function listUsage(req, res) {
  const query = req.query.order && validId(req.query.order) ? { orderRef: req.query.order } : {};
  return res.json({ data: await LaserCutUsage.find(query).sort({ reportedAt: -1 }).lean() });
}

export async function listAudit(req, res) {
  if (!req.query.entityType || !req.query.entityId) throw badRequest('Entity type and id are required');
  return res.json({ data: await LaserCutAudit.find({ entityType: req.query.entityType, entityId: req.query.entityId }).sort({ createdAt: -1 }).lean() });
}

export async function summary(req, res) {
  const [orders, stock, challans] = await Promise.all([LaserCutOrder.find().sort({ createdAt: -1 }).lean(), LaserCutStock.find().sort({ vendorName: 1, materialType: 1 }).lean(), LaserCutChallan.find().sort({ createdAt: -1 }).limit(100).lean()]);
  return res.json({ data: { orders: await ordersWithClientNames(orders), stock, challans } });
}
