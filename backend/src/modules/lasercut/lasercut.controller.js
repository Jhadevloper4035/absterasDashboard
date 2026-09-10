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
function dimensionsFor(materialType, values = {}) {
  const dimensions = { heightFt: number(values.heightFt), widthFt: number(values.widthFt), lengthFt: number(values.lengthFt) };
  if (materialType === 'SHEET' && (!Number.isFinite(dimensions.heightFt) || dimensions.heightFt <= 0 || !Number.isFinite(dimensions.widthFt) || dimensions.widthFt <= 0)) throw badRequest('Sheet height and width must be greater than zero');
  if (materialType === 'TUBE' && (!Number.isFinite(dimensions.lengthFt) || dimensions.lengthFt <= 0)) throw badRequest('Tube length must be greater than zero');
  return Object.fromEntries(Object.entries(dimensions).filter(([, value]) => Number.isFinite(value)));
}

export function materialKey(materialType, dimensions, inventoryItemRef) {
  if (materialType === 'OTHER') return `PRODUCT-${inventoryItemRef}`;
  const productKey = inventoryItemRef ? `${inventoryItemRef}-` : '';
  return materialType === 'SHEET' ? `SHEET-${productKey}${dimensions.heightFt}x${dimensions.widthFt}` : `TUBE-${productKey}${dimensions.lengthFt}`;
}

function cutOutputsFor(item, materialType, dimensions, quantity) {
  if (item?.cutOutputs !== undefined && !Array.isArray(item.cutOutputs)) throw badRequest('Smaller cut outputs must be a list');
  const requested = item?.cutOutputs || (item?.cutOutput ? [item.cutOutput] : []);
  const outputs = requested.map((output) => {
    const outputQuantity = number(output?.quantity);
    if (!Number.isFinite(outputQuantity) || outputQuantity <= 0) throw badRequest('Smaller cut quantity must be greater than zero');
    return { quantity: round(outputQuantity), dimensions: dimensionsFor(materialType, output.dimensions) };
  });
  const sourceSize = materialType === 'SHEET' ? quantity * dimensions.heightFt * dimensions.widthFt : quantity * dimensions.lengthFt;
  const outputSize = outputs.reduce((total, output) => total + (materialType === 'SHEET' ? output.quantity * output.dimensions.heightFt * output.dimensions.widthFt : output.quantity * output.dimensions.lengthFt), 0);
  if (outputSize > sourceSize + Number.EPSILON) throw badRequest(`Smaller ${materialType === 'SHEET' ? 'sheet area' : 'tube length'} cannot exceed the source material`);
  return outputs;
}

export function orderStatus(order) {
  const planned = order.planned || {}; const ready = order.ready || {};
  const hasCutPlan = number(planned.sheets) + number(planned.tubes) > 0;
  const expected = hasCutPlan ? planned : order.expected || {};
  const sent = hasCutPlan ? ready : order.sent || {};
  const remainingSheets = Math.max(number(expected.sheets) - number(sent.sheets), 0);
  const remainingTubes = Math.max(number(expected.tubes) - number(sent.tubes), 0);
  const expectedTotal = number(expected.sheets) + number(expected.tubes);
  const sentTotal = number(sent.sheets) + number(sent.tubes);
  return { remainingSheets: round(remainingSheets), remainingTubes: round(remainingTubes), status: expectedTotal === 0 || (hasCutPlan && sentTotal === 0) ? 'PENDING' : remainingSheets || remainingTubes ? 'PARTIAL' : 'COMPLETE' };
}

function sameDimensions(left = {}, right = {}) {
  return ['heightFt', 'widthFt', 'lengthFt'].every((field) => number(left[field] ?? 0) === number(right[field] ?? 0));
}

export function productionOutputs(challans, usages) {
  const rows = [];
  for (const challan of challans.filter((entry) => entry.type === 'OUT' && entry.status === 'DISPATCHED')) {
    for (const [lineIndex, item] of (challan.items || []).entries()) {
      const cutOutputs = item.cutOutputs?.length ? item.cutOutputs : item.cutOutput ? [item.cutOutput] : [];
      for (const [outputIndex, output] of cutOutputs.entries()) {
        rows.push({ challanRef: String(challan._id), lineIndex, outputIndex, vendorRef: String(challan.vendorRef), challanNo: challan.challanNo, itemName: item.itemName, inventoryItemRef: String(item.inventoryItemRef), materialType: item.materialType, sourceDimensions: item.dimensions, dimensions: output.dimensions, plannedQuantity: number(output.quantity), readyQuantity: 0 });
      }
    }
  }
  for (const usage of usages) {
    for (const output of usage.outputs?.length ? usage.outputs : usage.outputStockRef ? [{ quantity: usage.panelsProduced, dimensions: usage.outputDimensions }] : []) {
      const matches = rows.filter((row) => {
        if (usage.challanRef) return row.challanRef === String(usage.challanRef) && row.lineIndex === number(usage.sourceLineIndex) && (output.plannedOutputIndex === undefined || row.outputIndex === number(output.plannedOutputIndex));
        return row.materialType === usage.materialType && sameDimensions(row.sourceDimensions, usage.dimensions) && sameDimensions(row.dimensions, output.dimensions);
      });
      if (matches.length === 1) matches[0].readyQuantity = round(matches[0].readyQuantity + number(output.quantity));
    }
  }
  return rows.map((row) => ({ ...row, readyQuantity: round(row.readyQuantity), remainingQuantity: round(Math.max(row.plannedQuantity - row.readyQuantity, 0)) }));
}

function productionTotals(outputs, field) {
  return outputs.reduce((totals, output) => output.materialType === 'SHEET' ? { ...totals, sheets: round(totals.sheets + number(output[field])) } : output.materialType === 'TUBE' ? { ...totals, tubes: round(totals.tubes + number(output[field])) } : totals, { sheets: 0, tubes: 0 });
}

function orderView(order) {
  const value = plain(order);
  return { ...value, planned: { sheets: number(value.planned?.sheets || 0), tubes: number(value.planned?.tubes || 0) }, ready: { sheets: number(value.ready?.sheets || 0), tubes: number(value.ready?.tubes || 0) }, ...orderStatus(value) };
}

async function ordersWithClientNames(orders) {
  const clientIds = orders.map((order) => order.customerRef).filter(validId);
  const orderIds = orders.map((order) => order._id);
  const [clients, challans] = await Promise.all([
    clientIds.length ? Client.find({ _id: { $in: clientIds } }).select('name billingAddress shippingAddress').lean() : [],
    orderIds.length ? LaserCutChallan.find({ orderRef: { $in: orderIds }, type: 'OUT', status: 'DISPATCHED' }).sort({ createdAt: -1 }).lean() : [],
  ]);
  const clientById = new Map(clients.map((client) => [String(client._id), client]));
  const latestDispatchByOrder = new Map();
  for (const challan of challans) if (!latestDispatchByOrder.has(String(challan.orderRef))) latestDispatchByOrder.set(String(challan.orderRef), challan);
  return orders.map((order) => {
    const client = clientById.get(String(order.customerRef));
    const dispatch = latestDispatchByOrder.get(String(order._id));
    return { ...orderView(order), clientName: client?.name || '—', clientSiteName: dispatch?.clientSiteName, clientAddress: dispatch?.clientSiteAddressSnapshot || client?.shippingAddress || client?.billingAddress };
  });
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
    if (!dimensions && (item.cutOutput || item.cutOutputs?.length)) throw badRequest('Smaller cut outputs are only available for sheets and tubes');
    const cutOutputs = dimensions ? cutOutputsFor(item, materialType, dimensions, quantity) : [];
    const pickupSupplier = supplierById.get(String(material.supplier));
    return { inventoryItemRef: material._id, itemName: material.name, hsnCode: String(material.hsnCode || DEFAULT_HSN_CODE), unit: material.unit, pickupSupplierRef: pickupSupplier?._id, pickupSupplierName: pickupSupplier?.name, pickupAddressSnapshot: pickupSupplier?.address, materialType, quantity: round(quantity), dimensions, cutOutputs };
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

function cutOutputIncrement(items) {
  return items.reduce((totals, item) => {
    const field = item.materialType === 'SHEET' ? 'sheets' : item.materialType === 'TUBE' ? 'tubes' : undefined;
    const outputs = item.cutOutputs?.length ? item.cutOutputs : item.cutOutput ? [item.cutOutput] : [];
    return field ? { ...totals, [field]: round(totals[field] + outputs.reduce((total, output) => total + number(output.quantity), 0)) } : totals;
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
  const [challans, client, usages] = await Promise.all([
    LaserCutChallan.find({ orderRef: order._id }).sort({ createdAt: -1 }).lean(),
    validId(order.customerRef) ? Client.findById(order.customerRef).select('name gstin billingAddress shippingAddress state stateCode phone email').lean() : null,
    LaserCutUsage.find({ orderRef: order._id }).sort({ reportedAt: -1 }).lean(),
  ]);
  const outputs = productionOutputs(challans, usages);
  const productionOrder = outputs.length ? { ...order, planned: productionTotals(outputs, 'plannedQuantity'), ready: productionTotals(outputs, 'readyQuantity') } : order;
  return res.json({ data: { ...orderView(productionOrder), clientName: client?.name || '—', client: client || undefined, challans, production: { outputs, batches: usages.filter((usage) => usage.outputs?.length || usage.outputStockRef).map((usage) => ({ batchNo: usage.batchNo, reportedAt: usage.reportedAt, materialType: usage.materialType, panelsProduced: usage.panelsProduced })) } } });
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
  const vendorAddress = String(vendor.address || '').trim();
  if (!vendorAddress) throw badRequest('Laser-cut vendor address is required for the drop location');
  if (type === 'OUT' && !client) throw missing('Parent client not found');
  if (req.body.clientSiteRef && !clientSite) throw missing('Child client site not found');
  if (req.body.orderRef && !order) throw missing('Order not found');
  if (items.some((item) => item.cutOutputs?.length) && (type !== 'OUT' || !order)) throw badRequest('Smaller cut outputs require an outward challan linked to an order');
  const challan = await LaserCutChallan.create({ challanNo: `LC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`, type, challanDate: req.body.challanDate || undefined, clientRef: client?._id, clientName: client?.name, clientSiteRef: clientSite?._id, clientSiteName: clientSite?.siteName || clientSite?.name, clientSiteAddressSnapshot: clientSite?.siteAddress || clientSite?.shippingAddress || clientSite?.billingAddress, deliveryAddress: vendorAddress, vendorRef: vendor._id, vendorName: vendor.name, vendorAddressSnapshot: vendorAddress, transportType: String(req.body.transportType || '').trim() || undefined, vehicleNumber: String(req.body.vehicleNumber || '').trim() || undefined, eWayBillNumber: String(req.body.eWayBillNumber || '').trim() || undefined, orderRef: order?._id, items, createdBy: req.user._id });
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
        const planned = cutOutputIncrement(challan.items);
        const order = await LaserCutOrder.findByIdAndUpdate(challan.orderRef, { $inc: { 'sent.sheets': totals.sheets, 'sent.tubes': totals.tubes, 'planned.sheets': planned.sheets, 'planned.tubes': planned.tubes } }, { new: true, session });
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
  const outputDimensions = panelsProduced > 0 ? dimensionsFor(req.body.materialType, req.body.outputDimensions) : undefined;
  const consumedSize = req.body.materialType === 'SHEET' ? quantityConsumed * dimensions.heightFt * dimensions.widthFt : quantityConsumed * dimensions.lengthFt;
  const producedSize = outputDimensions && (req.body.materialType === 'SHEET' ? panelsProduced * outputDimensions.heightFt * outputDimensions.widthFt : panelsProduced * outputDimensions.lengthFt);
  if (producedSize && producedSize > consumedSize + Number.EPSILON) throw badRequest(`Produced ${req.body.materialType === 'SHEET' ? 'sheet area' : 'tube length'} cannot exceed consumed ${req.body.materialType === 'SHEET' ? 'sheet area' : 'tube length'}`);
  const session = await mongoose.startSession(); let usage;
  try {
    await session.withTransaction(async () => {
      const order = await LaserCutOrder.findById(req.body.orderRef).session(session); if (!order) throw missing('Order not found');
      const key = materialKey(req.body.materialType, dimensions);
      const stock = await LaserCutStock.findOneAndUpdate({ vendorRef: req.body.vendorRef, materialKey: key, quantityAvailable: { $gte: quantityConsumed } }, { $inc: { quantityAvailable: -quantityConsumed } }, { new: true, session });
      if (!stock) throw conflict('Vendor stock is insufficient for this usage entry');
      let outputStock;
      if (outputDimensions) {
        const outputKey = materialKey(req.body.materialType, outputDimensions, stock.inventoryItemRef);
        outputStock = await LaserCutStock.findOneAndUpdate(
          { vendorRef: stock.vendorRef, materialKey: outputKey },
          { $setOnInsert: { vendorName: stock.vendorName, inventoryItemRef: stock.inventoryItemRef, itemName: stock.itemName, hsnCode: stock.hsnCode, unit: stock.unit, materialType: req.body.materialType, dimensions: outputDimensions }, $inc: { quantityAvailable: panelsProduced } },
          { new: true, upsert: true, session },
        );
      }
      const panelArea = number(order.panelSpec?.panelAreaSqFt); const consumedArea = req.body.materialType === 'SHEET' ? quantityConsumed * dimensions.heightFt * dimensions.widthFt : undefined;
      const wastageAreaSqFt = consumedArea && Number.isFinite(panelArea) && panelArea > 0 ? round(Math.max(consumedArea - panelsProduced * panelArea, 0)) : undefined;
      const wastagePercent = wastageAreaSqFt === undefined ? undefined : round((wastageAreaSqFt / consumedArea) * 100);
      [usage] = await LaserCutUsage.create([{ vendorRef: req.body.vendorRef, orderRef: order._id, materialType: req.body.materialType, dimensions, quantityConsumed: round(quantityConsumed), panelsProduced, outputDimensions, outputStockRef: outputStock?._id, wastageAreaSqFt, wastagePercent, createdBy: req.user._id }], { session });
      await writeAudit({ session, entityType: 'LASER_CUT_STOCK', entityId: stock._id, action: 'USAGE_REPORTED', performedBy: req.user._id, after: plain(stock), metadata: { usageId: usage._id } });
      if (outputStock) await writeAudit({ session, entityType: 'LASER_CUT_STOCK', entityId: outputStock._id, action: 'CUT_OUTPUT', performedBy: req.user._id, after: plain(outputStock), metadata: { usageId: usage._id, quantity: panelsProduced } });
      await writeAudit({ session, entityType: 'USAGE_ENTRY', entityId: usage._id, action: 'USAGE_REPORTED', performedBy: req.user._id, after: plain(usage) });
    });
  } finally { await session.endSession(); }
  return res.status(201).json({ data: usage });
}

export async function recordReadyBatch(req, res) {
  if (!validId(req.params.id) || !Array.isArray(req.body?.items) || !req.body.items.length) throw badRequest('Select at least one ready cut output');
  const entries = new Map();
  for (const item of req.body.items) {
    const quantityReady = number(item?.quantity);
    const lineIndex = number(item?.lineIndex); const outputIndex = number(item?.outputIndex);
    if (!validId(item?.challanRef) || !Number.isInteger(lineIndex) || lineIndex < 0 || !Number.isInteger(outputIndex) || outputIndex < 0 || !Number.isFinite(quantityReady) || quantityReady <= 0) throw badRequest('Each ready batch quantity must be valid');
    const key = `${item.challanRef}:${lineIndex}:${outputIndex}`;
    entries.set(key, { challanRef: String(item.challanRef), lineIndex, outputIndex, quantity: round((entries.get(key)?.quantity || 0) + quantityReady) });
  }
  const session = await mongoose.startSession(); let result;
  try {
    await session.withTransaction(async () => {
      const order = await LaserCutOrder.findById(req.params.id).session(session);
      if (!order) throw missing('Order not found');
      const challanRefs = new Set([...entries.values()].map((entry) => entry.challanRef));
      const challans = await LaserCutChallan.find({ orderRef: order._id, type: 'OUT', status: 'DISPATCHED' }).session(session).lean();
      if ([...challanRefs].some((challanRef) => !challans.some((challan) => String(challan._id) === challanRef))) throw badRequest('Ready output must belong to a dispatched challan for this order');
      const existingUsages = await LaserCutUsage.find({ orderRef: order._id }).session(session).lean();
      const rows = productionOutputs(challans, existingUsages);
      const rowByKey = new Map(rows.map((row) => [`${row.challanRef}:${row.lineIndex}:${row.outputIndex}`, row]));
      const selected = [...entries.values()].map((entry) => ({ ...entry, row: rowByKey.get(`${entry.challanRef}:${entry.lineIndex}:${entry.outputIndex}`) }));
      if (selected.some((entry) => !entry.row || entry.quantity > entry.row.remainingQuantity)) throw conflict('Ready quantity exceeds the planned smaller cut output');
      const challanById = new Map(challans.map((challan) => [String(challan._id), challan]));
      const bySource = new Map();
      for (const entry of selected) {
        const key = `${entry.challanRef}:${entry.lineIndex}`;
        const source = bySource.get(key) || { challan: challanById.get(entry.challanRef), lineIndex: entry.lineIndex, entries: [] };
        source.entries.push(entry); bySource.set(key, source);
      }
      const ready = { sheets: 0, tubes: 0 };
      const batchNo = `LCB-${Date.now().toString(36).toUpperCase()}`;
      for (const source of bySource.values()) {
        const item = source.challan.items[source.lineIndex];
        if (!item) throw badRequest('Ready output source material was not found');
        const sourceSize = item.materialType === 'SHEET' ? number(item.dimensions?.heightFt) * number(item.dimensions?.widthFt) : number(item.dimensions?.lengthFt);
        const outputSize = source.entries.reduce((total, entry) => total + entry.quantity * (item.materialType === 'SHEET' ? number(entry.row.dimensions?.heightFt) * number(entry.row.dimensions?.widthFt) : number(entry.row.dimensions?.lengthFt)), 0);
        const quantityConsumed = round(outputSize / sourceSize);
        if (!Number.isFinite(quantityConsumed) || quantityConsumed <= 0) throw badRequest('Ready output dimensions are invalid');
        const sourceKey = materialKey(item.materialType, item.dimensions, item.inventoryItemRef);
        const sourceStock = await LaserCutStock.findOneAndUpdate({ vendorRef: source.challan.vendorRef, materialKey: sourceKey, quantityAvailable: { $gte: quantityConsumed } }, { $inc: { quantityAvailable: -quantityConsumed } }, { new: true, session });
        if (!sourceStock) throw conflict(`Laser-cut stock is insufficient for ${item.itemName}`);
        const outputs = [];
        for (const entry of source.entries) {
          const outputKey = materialKey(item.materialType, entry.row.dimensions, item.inventoryItemRef);
          const outputStock = await LaserCutStock.findOneAndUpdate(
            { vendorRef: source.challan.vendorRef, materialKey: outputKey },
            { $setOnInsert: { vendorName: source.challan.vendorName, inventoryItemRef: item.inventoryItemRef, itemName: item.itemName, hsnCode: item.hsnCode, unit: item.unit, materialType: item.materialType, dimensions: entry.row.dimensions }, $inc: { quantityAvailable: entry.quantity } },
            { new: true, upsert: true, session },
          );
          outputs.push({ quantity: entry.quantity, dimensions: entry.row.dimensions, outputStockRef: outputStock._id, plannedOutputIndex: entry.outputIndex, stock: outputStock });
          if (item.materialType === 'SHEET') ready.sheets = round(ready.sheets + entry.quantity);
          if (item.materialType === 'TUBE') ready.tubes = round(ready.tubes + entry.quantity);
        }
        const [usage] = await LaserCutUsage.create([{ vendorRef: source.challan.vendorRef, orderRef: order._id, challanRef: source.challan._id, sourceLineIndex: source.lineIndex, batchNo, materialType: item.materialType, dimensions: item.dimensions, quantityConsumed, panelsProduced: outputs.reduce((total, output) => total + output.quantity, 0), outputs: outputs.map(({ stock, ...output }) => output), createdBy: req.user._id }], { session });
        await writeAudit({ session, entityType: 'LASER_CUT_STOCK', entityId: sourceStock._id, action: 'READY_BATCH_CONSUME', performedBy: req.user._id, after: plain(sourceStock), metadata: { batchNo, usageId: usage._id } });
        for (const output of outputs) await writeAudit({ session, entityType: 'LASER_CUT_STOCK', entityId: output.outputStockRef, action: 'READY_BATCH_OUTPUT', performedBy: req.user._id, after: plain(output.stock), metadata: { batchNo, usageId: usage._id, quantity: output.quantity } });
      }
      const planned = productionTotals(rows, 'plannedQuantity');
      const previousReady = productionTotals(rows, 'readyQuantity');
      order.planned = planned;
      order.ready = { sheets: round(previousReady.sheets + ready.sheets), tubes: round(previousReady.tubes + ready.tubes) };
      order.status = orderStatus(order).status; await order.save({ session });
      await writeAudit({ session, entityType: 'ORDER', entityId: order._id, action: 'READY_BATCH', performedBy: req.user._id, after: plain(order), metadata: { batchNo, ready } });
      result = { order: orderView(order), batchNo };
    });
  } finally { await session.endSession(); }
  return res.status(201).json({ data: result });
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
