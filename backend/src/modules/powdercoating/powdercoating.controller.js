import mongoose from 'mongoose';
import { DEFAULT_HSN_CODE, InventoryItem } from '../inventory/models/item.model.js';
import { Client } from '../clients/models/client.model.js';
import { Supplier } from '../inventory/models/supplier.model.js';
import { StockTransaction } from '../inventory/models/transaction.model.js';
import { LaserCutAudit, LaserCutChallan, LaserCutOrder, LaserCutStock, LaserCutUsage, LaserCutVendor } from '../lasercut/models.js';
import { PowderCoatChallan, PowderCoatOrder, PowderCoatVendor } from './models.js';

const badRequest = (message) => Object.assign(new Error(message), { statusCode: 400 });
const conflict = (message) => Object.assign(new Error(message), { statusCode: 409 });
const missing = (message) => Object.assign(new Error(message), { statusCode: 404 });
const validId = (value) => mongoose.isObjectIdOrHexString(value);
const quantity = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const orderNumber = () => `PC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
const challanNumber = () => `PC-C-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
const vendorFields = ['name', 'contactPerson', 'phone', 'email', 'address', 'notes', 'status'];
const vendorPayload = (body) => Object.fromEntries(vendorFields.filter((field) => body?.[field] !== undefined).map((field) => [field, body[field]]));
const transferKey = (vendorRef, inventoryItemRef) => `${String(vendorRef)}:${String(inventoryItemRef)}`;
const orderItemKey = (item) => item.laserCutStockRef ? `stock:${String(item.laserCutStockRef)}` : `product:${String(item.inventoryItemRef)}`;
const usageOutputs = (usage) => usage.outputs?.length ? usage.outputs : usage.outputStockRef ? [{ outputStockRef: usage.outputStockRef, quantity: usage.panelsProduced }] : [];
export const transactionUnsupported = (error) => /transactions are not supported|only servers in a sharded cluster can start a new transaction/i.test(String(error?.message || ''));

export function remainingLaserCutTransferItems(challans, powderOrders) {
  const available = new Map();
  for (const challan of challans.filter((entry) => entry.type === 'OUT' && entry.status === 'DISPATCHED')) {
    for (const item of challan.items || []) {
      const key = transferKey(challan.vendorRef, item.inventoryItemRef);
      const current = available.get(key) || { inventoryItemRef: item.inventoryItemRef, vendorRef: challan.vendorRef, vendorName: challan.vendorName, pickupAddressSnapshot: challan.deliveryAddress || challan.vendorAddressSnapshot, itemName: item.itemName, hsnCode: item.hsnCode, unit: item.unit, quantity: 0 };
      current.quantity += Number(item.quantity);
      available.set(key, current);
    }
  }
  for (const order of powderOrders) {
    for (const item of order.items || []) {
      if (item.source !== 'LASER_CUT') continue;
      const current = available.get(transferKey(item.pickupSupplierRef, item.inventoryItemRef));
      if (current) current.quantity -= Number(item.quantity);
    }
  }
  return [...available.values()].map((item) => ({ ...item, quantity: quantity(Math.max(item.quantity, 0)) })).filter((item) => item.quantity > 0);
}

async function laserCutTransferItemsFor(orderRef, session) {
  const usages = LaserCutUsage.find({ orderRef, $or: [{ outputStockRef: { $exists: true } }, { 'outputs.outputStockRef': { $exists: true } }] }).select('outputStockRef panelsProduced outputs');
  const challans = LaserCutChallan.find({ orderRef, type: 'OUT', status: 'DISPATCHED' });
  const powderOrders = PowderCoatOrder.find({ laserCutOrderRef: orderRef }).select('items');
  if (session) { usages.session(session); challans.session(session); powderOrders.session(session); }
  const [producedUsages, dispatchedChallans, previousPowderOrders] = await Promise.all([usages.lean(), challans.lean(), powderOrders.lean()]);
  const producedOutputs = producedUsages.flatMap(usageOutputs);
  if (producedOutputs.length) {
    const outputStocks = LaserCutStock.find({ _id: { $in: producedOutputs.map((output) => output.outputStockRef) } });
    if (session) outputStocks.session(session);
    return remainingProducedLaserCutTransferItems(await outputStocks.lean(), producedUsages, previousPowderOrders);
  }
  if (dispatchedChallans.some((challan) => challan.items.some((item) => item.cutOutputs?.length || item.cutOutput))) return [];
  return remainingLaserCutTransferItems(dispatchedChallans, previousPowderOrders);
}

export function remainingProducedLaserCutTransferItems(stocks, usages, powderOrders) {
  const stockById = new Map(stocks.map((stock) => [String(stock._id), stock]));
  const available = new Map();
  for (const usage of usages) {
    for (const output of usageOutputs(usage)) {
      const stock = stockById.get(String(output.outputStockRef));
      if (!stock) continue;
      const key = String(stock._id);
      const current = available.get(key) || { laserCutStockRef: stock._id, inventoryItemRef: stock.inventoryItemRef, vendorRef: stock.vendorRef, vendorName: stock.vendorName, itemName: stock.itemName, hsnCode: stock.hsnCode, unit: stock.unit, dimensions: stock.dimensions, quantity: 0 };
      current.quantity += Number(output.quantity);
      available.set(key, current);
    }
  }
  for (const order of powderOrders) for (const item of order.items || []) {
    if (item.source !== 'LASER_CUT' || !item.laserCutStockRef) continue;
    const current = available.get(String(item.laserCutStockRef));
    if (current) current.quantity -= Number(item.quantity);
  }
  return [...available.values()].map((item) => ({ ...item, quantity: quantity(Math.max(item.quantity, 0)) })).filter((item) => item.quantity > 0);
}

async function assertLaserCutTransferAvailability(orderRef, items, session) {
  const available = new Map((await laserCutTransferItemsFor(orderRef, session)).map((item) => [orderItemKey(item), item.quantity]));
  const requested = new Map();
  for (const item of items.filter((entry) => entry.source === 'LASER_CUT')) {
    const key = orderItemKey(item);
    requested.set(key, quantity((requested.get(key) || 0) + item.quantity));
  }
  for (const [key, amount] of requested) {
    if (amount > Number(available.get(key) || 0)) throw conflict('Selected quantity exceeds the remaining balance for this Laser Cut order');
  }
}

export function readyItemsFor(order) {
  const ready = new Map();
  for (const item of order.items || []) {
    const key = orderItemKey(item);
    const current = ready.get(key) || { ...(item.toObject?.() || item), quantity: 0 };
    ready.set(key, current);
  }
  for (const batch of order.coatingBatches || []) for (const item of batch.items || []) {
    const current = ready.get(orderItemKey(item));
    if (current) current.quantity += Number(item.quantity);
  }
  return [...ready.values()];
}

export function remainingItemsFor(order, challans = []) {
  const expected = new Map();
  for (const item of readyItemsFor(order)) {
    const key = orderItemKey(item);
    const current = expected.get(key) || { ...item, quantity: 0 };
    current.quantity += Number(item.quantity);
    expected.set(key, current);
  }
  for (const challan of challans.filter((entry) => entry.type === 'SITE_OUT')) {
    for (const item of challan.items || []) {
      const current = expected.get(orderItemKey(item));
      if (current) current.quantity = Math.max(current.quantity - Number(item.quantity), 0);
    }
  }
  return [...expected.values()];
}

function orderView(order, challans = []) {
  const undeliveredItems = remainingItemsFor(order, challans);
  const totalQuantity = (order.items || []).reduce((total, item) => total + Number(item.quantity), 0);
  const readyQuantity = readyItemsFor(order).reduce((total, item) => total + Number(item.quantity), 0);
  const remainingItems = order.status === 'RETURNED' ? [] : undeliveredItems;
  const remainingQuantity = remainingItems.reduce((total, item) => total + Number(item.quantity), 0);
  const deliveredQuantity = readyQuantity - undeliveredItems.reduce((total, item) => total + Number(item.quantity), 0);
  const pendingCoatingQuantity = Math.max(totalQuantity - readyQuantity, 0);
  const deliveryStatus = order.status === 'RETURNED'
    ? 'RETURNED'
    : pendingCoatingQuantity === 0 && remainingQuantity === 0
      ? 'DELIVERED'
      : deliveredQuantity > 0
        ? 'PARTIAL_DELIVERY'
        : readyQuantity > 0 && pendingCoatingQuantity > 0
          ? 'PARTIAL_READY'
          : readyQuantity > 0
            ? 'READY_FOR_DELIVERY'
            : 'IN_COATING';
  return { ...(order.toObject?.() || order), remainingItems, totalQuantity, readyQuantity, pendingCoatingQuantity, deliveredQuantity, remainingQuantity, deliveryStatus };
}

export async function normalizedItems(items) {
  if (!Array.isArray(items) || !items.length) throw badRequest('At least one product is required');
  if (items.some((item) => !validId(item?.inventoryItemRef))) throw badRequest('Invalid inventory product');
  if (items.some((item) => item?.source === 'LASER_CUT' && !validId(item?.laserCutStockRef))) throw badRequest('Invalid laser-cut stock item');
  const materials = await InventoryItem.find({ _id: { $in: items.map((item) => item.inventoryItemRef) }, status: 'active' }).lean();
  const laserCutStockIds = items.filter((item) => item?.source === 'LASER_CUT').map((item) => item.laserCutStockRef);
  const laserCutStock = laserCutStockIds.length ? await LaserCutStock.find({ _id: { $in: laserCutStockIds } }).lean() : [];
  const supplierIds = materials.map((material) => material.supplier).filter(validId);
  const suppliers = await Supplier.find({ _id: { $in: supplierIds }, status: 'active' }).lean();
  const laserCutVendors = laserCutStock.length ? await LaserCutVendor.find({ _id: { $in: laserCutStock.map((stock) => stock.vendorRef) }, status: 'active' }).lean() : [];
  const productById = new Map(materials.map((material) => [String(material._id), material]));
  const supplierById = new Map(suppliers.map((supplier) => [String(supplier._id), supplier]));
  const laserCutVendorById = new Map(laserCutVendors.map((vendor) => [String(vendor._id), vendor]));
  const laserCutStockById = new Map(laserCutStock.map((stock) => [String(stock._id), stock]));
  return items.map((item) => {
    const product = productById.get(String(item.inventoryItemRef));
    const amount = quantity(item.quantity);
    if (!product) throw missing('Inventory product not found');
    if (product.category === 'hardware') throw badRequest(`${product.name} is hardware and cannot be sent for powder coating`);
    if (!Number.isFinite(amount) || amount <= 0) throw badRequest('Product quantity must be greater than zero');
    const source = item.source === 'LASER_CUT' ? 'LASER_CUT' : 'INVENTORY';
    const sourceStock = source === 'LASER_CUT' ? laserCutStockById.get(String(item.laserCutStockRef)) : undefined;
    if (source === 'LASER_CUT' && (!sourceStock || String(sourceStock.inventoryItemRef) !== String(product._id))) throw missing('Laser-cut stock item not found');
    const shadeName = String(source === 'LASER_CUT' ? item.shadeName || '' : item.shadeName || product.shadeName || '').trim();
    const shadeCode = String(source === 'LASER_CUT' ? item.shadeCode || '' : item.shadeCode || product.shadeCode || '').trim();
    if (!shadeName || !shadeCode) throw badRequest(`${product.name} needs a shade name and shade code before powder coating`);
    const pickupSupplier = supplierById.get(String(product.supplier));
    return {
      inventoryItemRef: product._id,
      itemName: product.name,
      hsnCode: String(product.hsnCode || DEFAULT_HSN_CODE),
      unit: product.unit,
      ...(sourceStock?.dimensions ? { dimensions: sourceStock.dimensions } : {}),
      quantity: amount,
      shadeName,
      shadeCode,
      shadeImage: product.shadeImage,
      source,
      laserCutStockRef: sourceStock?._id,
      pickupSupplierRef: sourceStock?.vendorRef || pickupSupplier?._id,
      pickupSupplierName: sourceStock?.vendorName || pickupSupplier?.name,
      pickupAddressSnapshot: sourceStock ? laserCutVendorById.get(String(sourceStock.vendorRef))?.address : pickupSupplier?.address,
    };
  });
}

async function orderContext(body, items) {
  if (!validId(body.clientRef) || !validId(body.vendorRef)) throw badRequest('A parent client and powder-coating vendor are required');
  if (body.clientSiteRef && !validId(body.clientSiteRef)) throw badRequest('Invalid child client site');
  const [client, vendor, site] = await Promise.all([
    Client.findOne({ _id: body.clientRef, parentClient: null }).lean(),
    PowderCoatVendor.findOne({ _id: body.vendorRef, status: 'active' }).lean(),
    body.clientSiteRef ? Client.findOne({ _id: body.clientSiteRef, parentClient: body.clientRef }).lean() : null,
  ]);
  if (!client) throw missing('Parent client not found');
  if (!vendor) throw missing('Active powder-coating vendor not found');
  const vendorAddress = String(vendor.address || '').trim();
  if (!vendorAddress) throw badRequest('Powder-coating vendor address is required for the drop location');
  if (body.clientSiteRef && !site) throw missing('Child client site not found');
  let laserCutOrder;
  if (body.laserCutOrderRef) {
    if (!validId(body.laserCutOrderRef)) throw badRequest('Invalid laser-cut order');
    laserCutOrder = await LaserCutOrder.findById(body.laserCutOrderRef).lean();
    if (!laserCutOrder) throw missing('Laser-cut order not found');
    if (items.some((item) => item.source !== 'LASER_CUT')) throw badRequest('A laser-cut order can only move laser-cut stock to powder coating');
  }
  // ponytail: Laser-cut stock is a shared vendor pool; add per-order stock allocation only if batches must reserve a specific dispatch.
  if (items.some((item) => item.source === 'LASER_CUT') && !laserCutOrder) throw badRequest('A laser-cut order is required for laser-cut stock');
  return {
    clientRef: client._id,
    clientName: client.name,
    clientSiteRef: site?._id,
    clientSiteName: site?.siteName || site?.name,
    clientSiteAddressSnapshot: site?.siteAddress || site?.shippingAddress || site?.billingAddress,
    vendorRef: vendor._id,
    vendorName: vendor.name,
    vendorAddressSnapshot: vendorAddress,
    transportType: String(body.transportType || '').trim() || undefined,
    vehicleNumber: String(body.vehicleNumber || '').trim() || undefined,
    eWayBillNumber: String(body.eWayBillNumber || '').trim() || undefined,
    challanDate: body.challanDate || undefined,
    laserCutOrderRef: laserCutOrder?._id,
    laserCutOrderName: laserCutOrder?.orderName,
    items,
  };
}

export async function listVendors(req, res) { return res.json({ data: await PowderCoatVendor.find(req.query.status ? { status: req.query.status } : {}).sort({ name: 1 }).lean() }); }
export async function createVendor(req, res) { const vendor = await PowderCoatVendor.create(vendorPayload(req.body)); return res.status(201).json({ data: vendor }); }
export async function updateVendor(req, res) { if (!validId(req.params.id)) throw badRequest('Invalid powder-coating vendor'); const vendor = await PowderCoatVendor.findByIdAndUpdate(req.params.id, vendorPayload(req.body), { new: true, runValidators: true }); if (!vendor) throw missing('Powder-coating vendor not found'); return res.json({ data: vendor }); }
export async function deleteVendor(req, res) { if (!validId(req.params.id)) throw badRequest('Invalid powder-coating vendor'); const vendor = await PowderCoatVendor.findByIdAndUpdate(req.params.id, { status: 'inactive' }, { new: true, runValidators: true }); if (!vendor) throw missing('Powder-coating vendor not found'); return res.json({ data: vendor }); }

export async function createOrder(req, res) {
  const items = await normalizedItems(req.body?.items);
  const context = await orderContext(req.body || {}, items);
  const session = await mongoose.startSession();
  let created;
  const writeOrder = async (activeSession) => {
    if (context.laserCutOrderRef) await assertLaserCutTransferAvailability(context.laserCutOrderRef, items, activeSession);
    const [order] = await PowderCoatOrder.create([{ ...context, orderNo: orderNumber(), createdBy: req.user._id }], { session: activeSession });
    const [challan] = await PowderCoatChallan.create([{ ...context, challanNo: challanNumber(), type: 'OUT', orderRef: order._id, createdBy: req.user._id }], { session: activeSession });
    for (const item of items) {
      if (item.source === 'LASER_CUT') {
        const stock = await LaserCutStock.findOneAndUpdate({ _id: item.laserCutStockRef, inventoryItemRef: item.inventoryItemRef, quantityAvailable: { $gte: item.quantity } }, { $inc: { quantityAvailable: -item.quantity } }, { new: true, session: activeSession });
        if (!stock) throw conflict(`Insufficient laser-cut stock for ${item.itemName}`);
        await LaserCutAudit.create([{ entityType: 'LASER_CUT_STOCK', entityId: String(stock._id), action: 'TRANSFER_TO_POWDER_COATING', performedBy: req.user._id, after: stock.toObject(), metadata: { orderNo: order.orderNo, challanNo: challan.challanNo, quantity: item.quantity } }], { session: activeSession });
        continue;
      }
      const product = await InventoryItem.findOneAndUpdate({ _id: item.inventoryItemRef, quantityInStock: { $gte: item.quantity } }, { $inc: { quantityInStock: -item.quantity } }, { new: true, session: activeSession });
      if (!product) throw conflict(`Insufficient stock for ${item.itemName}`);
      await StockTransaction.create([{ item: product._id, type: 'out', quantity: item.quantity, reference: challan.challanNo, note: `Powder coating outward challan ${challan.challanNo}`, performedBy: req.user._id }], { session: activeSession });
    }
    order.outwardChallanRef = challan._id;
    await order.save({ session: activeSession });
    created = { order, challan };
  };
  try {
    await session.withTransaction(() => writeOrder(session));
  } catch (error) {
    if (!transactionUnsupported(error)) throw error;
    await writeOrder();
  } finally { await session.endSession(); }
  return res.status(201).json({ data: created });
}

export async function getLaserCutTransferItems(req, res) {
  if (!validId(req.params.id)) throw badRequest('Invalid laser-cut order');
  const [order, items] = await Promise.all([LaserCutOrder.findById(req.params.id).lean(), laserCutTransferItemsFor(req.params.id)]);
  if (!order) throw missing('Laser-cut order not found');
  return res.json({ data: items });
}

export async function receiveOrder(req, res) {
  if (!validId(req.params.id)) throw badRequest('Invalid powder-coating order');
  const session = await mongoose.startSession();
  let received;
  try {
    await session.withTransaction(async () => {
      const order = await PowderCoatOrder.findOne({ _id: req.params.id, status: 'OUT' }).session(session);
      if (!order) throw conflict('Only outward powder-coating orders can be received');
      const siteChallans = await PowderCoatChallan.find({ orderRef: order._id, type: 'SITE_OUT' }).session(session);
      const remainingItems = remainingItemsFor(order, siteChallans);
      if (!remainingItems.some((item) => item.quantity > 0)) throw conflict('This powder-coating order has already been sent to the client site');
      const [challan] = await PowderCoatChallan.create([{
        challanNo: challanNumber(), type: 'IN', orderRef: order._id, clientRef: order.clientRef, clientName: order.clientName, clientSiteRef: order.clientSiteRef, clientSiteName: order.clientSiteName, clientSiteAddressSnapshot: order.clientSiteAddressSnapshot,
        vendorRef: order.vendorRef, vendorName: order.vendorName, vendorAddressSnapshot: order.vendorAddressSnapshot, items: remainingItems, createdBy: req.user._id,
      }], { session });
      for (const item of remainingItems) {
        const product = await InventoryItem.findByIdAndUpdate(item.inventoryItemRef, { $inc: { quantityInStock: item.quantity } }, { new: true, session });
        if (!product) throw missing(`Inventory product not found for ${item.itemName}`);
        await StockTransaction.create([{ item: product._id, type: 'in', quantity: item.quantity, reference: challan.challanNo, note: `Powder coating inward challan ${challan.challanNo}`, performedBy: req.user._id }], { session });
      }
      order.status = 'RETURNED';
      order.inwardChallanRef = challan._id;
      await order.save({ session });
      received = { order, challan };
    });
  } finally { await session.endSession(); }
  return res.json({ data: received });
}

export async function dispatchToSite(req, res) {
  if (!validId(req.params.id)) throw badRequest('Invalid powder-coating order');
  if (!Array.isArray(req.body?.items) || !req.body.items.length) throw badRequest('Select at least one product quantity');
  const requested = new Map();
  for (const item of req.body.items) {
    if (!validId(item?.inventoryItemRef)) throw badRequest('Invalid powder-coating product');
    if (item.laserCutStockRef && !validId(item.laserCutStockRef)) throw badRequest('Invalid laser-cut stock item');
    const amount = quantity(item.quantity);
    if (!Number.isFinite(amount) || amount <= 0) throw badRequest('Product quantity must be greater than zero');
    const key = orderItemKey(item);
    const current = requested.get(key) || { inventoryItemRef: String(item.inventoryItemRef), laserCutStockRef: item.laserCutStockRef, quantity: 0 };
    current.quantity += amount;
    requested.set(key, current);
  }
  const order = await PowderCoatOrder.findOne({ _id: req.params.id, status: 'OUT' });
  if (!order) throw conflict('Only outward powder-coating orders can be sent to a client site');
  const previous = await PowderCoatChallan.find({ orderRef: order._id, type: 'SITE_OUT' });
  const remainingByItem = new Map(remainingItemsFor(order, previous).map((item) => [orderItemKey(item), item]));
  const items = [...requested].map(([key, requestedItem]) => {
    const item = remainingByItem.get(key);
    if (!item) throw badRequest('Product does not belong to this powder-coating order');
    if (requestedItem.quantity > item.quantity) throw conflict(`Only ${item.quantity} ${item.unit || ''} of ${item.itemName} remains at powder coating`);
    return { ...item, quantity: requestedItem.quantity };
  });
  const [challan] = await PowderCoatChallan.create([{
    challanNo: challanNumber(), type: 'SITE_OUT', challanDate: req.body.challanDate || undefined, orderRef: order._id,
    clientRef: order.clientRef, clientName: order.clientName, clientSiteRef: order.clientSiteRef, clientSiteName: order.clientSiteName, clientSiteAddressSnapshot: order.clientSiteAddressSnapshot,
    vendorRef: order.vendorRef, vendorName: order.vendorName, vendorAddressSnapshot: order.vendorAddressSnapshot,
    transportType: String(req.body.transportType || '').trim() || undefined, vehicleNumber: String(req.body.vehicleNumber || '').trim() || undefined, eWayBillNumber: String(req.body.eWayBillNumber || '').trim() || undefined,
    items, createdBy: req.user._id,
  }]);
  const created = { challan, order: orderView(order, [...previous, challan]) };
  return res.status(201).json({ data: created });
}

export async function recordReadyBatch(req, res) {
  if (!validId(req.params.id)) throw badRequest('Invalid powder-coating order');
  if (!Array.isArray(req.body?.items) || !req.body.items.length) throw badRequest('Enter at least one ready quantity');
  const order = await PowderCoatOrder.findOne({ _id: req.params.id, status: 'OUT' });
  if (!order) throw conflict('Only outward powder-coating orders can record ready batches');
  const planned = new Map((order.items || []).map((item) => [orderItemKey(item), Number(item.quantity)]));
  const ready = new Map(readyItemsFor(order).map((item) => [orderItemKey(item), Number(item.quantity)]));
  const entries = new Map();
  for (const item of req.body.items) {
    if (!validId(item?.inventoryItemRef) || (item.laserCutStockRef && !validId(item.laserCutStockRef))) throw badRequest('Each ready product must be valid');
    const amount = quantity(item.quantity);
    if (!Number.isFinite(amount) || amount <= 0) throw badRequest('Each ready quantity must be greater than zero');
    const key = orderItemKey(item);
    entries.set(key, { inventoryItemRef: item.inventoryItemRef, laserCutStockRef: item.laserCutStockRef, quantity: quantity((entries.get(key)?.quantity || 0) + amount) });
  }
  for (const [key, item] of entries) {
    if (!planned.has(key)) throw badRequest('Ready product does not belong to this powder-coating order');
    if (item.quantity > Number(planned.get(key) || 0) - Number(ready.get(key) || 0)) throw conflict('Ready quantity cannot exceed the pending coating quantity');
  }
  const batchNo = `PCB-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  order.coatingBatches.push({ batchNo, items: [...entries.values()], recordedAt: new Date(), createdBy: req.user._id });
  await order.save();
  const challans = await PowderCoatChallan.find({ orderRef: order._id, type: 'SITE_OUT' }).lean();
  return res.status(201).json({ data: { order: orderView(order, challans), batchNo } });
}

export async function listOrders(_req, res) {
  const [orders, challans] = await Promise.all([PowderCoatOrder.find().sort({ createdAt: -1 }).lean(), PowderCoatChallan.find({ type: 'SITE_OUT' }).lean()]);
  return res.json({ data: orders.map((order) => orderView(order, challans.filter((challan) => String(challan.orderRef) === String(order._id)))) });
}

export async function getOrder(req, res) {
  if (!validId(req.params.id)) throw badRequest('Invalid powder-coating order');
  const order = await PowderCoatOrder.findById(req.params.id).lean();
  if (!order) throw missing('Powder-coating order not found');
  const challans = await PowderCoatChallan.find({ orderRef: order._id }).sort({ createdAt: -1 }).lean();
  return res.json({ data: { ...orderView(order, challans), challans } });
}

export async function listChallans(_req, res) {
  return res.json({ data: await PowderCoatChallan.find().sort({ createdAt: -1 }).lean() });
}

export async function summary(_req, res) {
  const [orders, challans, siteChallans] = await Promise.all([PowderCoatOrder.find().sort({ createdAt: -1 }).lean(), PowderCoatChallan.find().sort({ createdAt: -1 }).limit(100).lean(), PowderCoatChallan.find({ type: 'SITE_OUT' }).lean()]);
  return res.json({ data: { orders: orders.map((order) => orderView(order, siteChallans.filter((challan) => String(challan.orderRef) === String(order._id)))), challans } });
}
