import mongoose from 'mongoose';
import { DEFAULT_HSN_CODE, InventoryItem } from '../inventory/models/item.model.js';
import { Client } from '../clients/models/client.model.js';
import { Supplier } from '../inventory/models/supplier.model.js';
import { StockTransaction } from '../inventory/models/transaction.model.js';
import { LaserCutAudit, LaserCutOrder, LaserCutStock, LaserCutVendor } from '../lasercut/models.js';
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

export function remainingItemsFor(order, challans = []) {
  const expected = new Map();
  for (const item of order.items || []) {
    const key = String(item.inventoryItemRef);
    const current = expected.get(key) || { ...(item.toObject?.() || item), quantity: 0 };
    current.quantity += Number(item.quantity);
    expected.set(key, current);
  }
  for (const challan of challans.filter((entry) => entry.type === 'SITE_OUT')) {
    for (const item of challan.items || []) {
      const current = expected.get(String(item.inventoryItemRef));
      if (current) current.quantity = Math.max(current.quantity - Number(item.quantity), 0);
    }
  }
  return [...expected.values()];
}

function orderView(order, challans = []) {
  const undeliveredItems = remainingItemsFor(order, challans);
  const totalQuantity = (order.items || []).reduce((total, item) => total + Number(item.quantity), 0);
  const remainingItems = order.status === 'RETURNED' ? [] : undeliveredItems;
  const remainingQuantity = remainingItems.reduce((total, item) => total + Number(item.quantity), 0);
  const deliveredQuantity = totalQuantity - undeliveredItems.reduce((total, item) => total + Number(item.quantity), 0);
  return { ...(order.toObject?.() || order), remainingItems, totalQuantity, deliveredQuantity, remainingQuantity, deliveryStatus: remainingQuantity ? remainingQuantity === totalQuantity ? 'AT_VENDOR' : 'PARTIAL' : 'DELIVERED' };
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
  if (body.clientSiteRef && !site) throw missing('Child client site not found');
  let laserCutOrder;
  if (body.laserCutOrderRef) {
    if (!validId(body.laserCutOrderRef)) throw badRequest('Invalid laser-cut order');
    laserCutOrder = await LaserCutOrder.findById(body.laserCutOrderRef).lean();
    if (!laserCutOrder) throw missing('Laser-cut order not found');
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
    vendorAddressSnapshot: String(vendor.address || '').trim() || undefined,
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
  try {
    await session.withTransaction(async () => {
      const [order] = await PowderCoatOrder.create([{ ...context, orderNo: orderNumber(), createdBy: req.user._id }], { session });
      const [challan] = await PowderCoatChallan.create([{ ...context, challanNo: challanNumber(), type: 'OUT', orderRef: order._id, createdBy: req.user._id }], { session });
      for (const item of items) {
        if (item.source === 'LASER_CUT') {
          const stock = await LaserCutStock.findOneAndUpdate({ _id: item.laserCutStockRef, inventoryItemRef: item.inventoryItemRef, quantityAvailable: { $gte: item.quantity } }, { $inc: { quantityAvailable: -item.quantity } }, { new: true, session });
          if (!stock) throw conflict(`Insufficient laser-cut stock for ${item.itemName}`);
          await LaserCutAudit.create([{ entityType: 'LASER_CUT_STOCK', entityId: String(stock._id), action: 'TRANSFER_TO_POWDER_COATING', performedBy: req.user._id, after: stock.toObject(), metadata: { orderNo: order.orderNo, challanNo: challan.challanNo, quantity: item.quantity } }], { session });
          continue;
        }
        const product = await InventoryItem.findOneAndUpdate({ _id: item.inventoryItemRef, quantityInStock: { $gte: item.quantity } }, { $inc: { quantityInStock: -item.quantity } }, { new: true, session });
        if (!product) throw conflict(`Insufficient stock for ${item.itemName}`);
        await StockTransaction.create([{ item: product._id, type: 'out', quantity: item.quantity, reference: challan.challanNo, note: `Powder coating outward challan ${challan.challanNo}`, performedBy: req.user._id }], { session });
      }
      order.outwardChallanRef = challan._id;
      await order.save({ session });
      created = { order, challan };
    });
  } finally { await session.endSession(); }
  return res.status(201).json({ data: created });
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
    const amount = quantity(item.quantity);
    if (!Number.isFinite(amount) || amount <= 0) throw badRequest('Product quantity must be greater than zero');
    requested.set(String(item.inventoryItemRef), (requested.get(String(item.inventoryItemRef)) || 0) + amount);
  }
  const session = await mongoose.startSession();
  let created;
  try {
    await session.withTransaction(async () => {
      const order = await PowderCoatOrder.findOne({ _id: req.params.id, status: 'OUT' }).session(session);
      if (!order) throw conflict('Only outward powder-coating orders can be sent to a client site');
      const previous = await PowderCoatChallan.find({ orderRef: order._id, type: 'SITE_OUT' }).session(session);
      const remainingByItem = new Map(remainingItemsFor(order, previous).map((item) => [String(item.inventoryItemRef), item]));
      const items = [...requested].map(([inventoryItemRef, amount]) => {
        const item = remainingByItem.get(inventoryItemRef);
        if (!item) throw badRequest('Product does not belong to this powder-coating order');
        if (amount > item.quantity) throw conflict(`Only ${item.quantity} ${item.unit || ''} of ${item.itemName} remains at powder coating`);
        return { ...item, quantity: amount };
      });
      const [challan] = await PowderCoatChallan.create([{
        challanNo: challanNumber(), type: 'SITE_OUT', challanDate: req.body.challanDate || undefined, orderRef: order._id,
        clientRef: order.clientRef, clientName: order.clientName, clientSiteRef: order.clientSiteRef, clientSiteName: order.clientSiteName, clientSiteAddressSnapshot: order.clientSiteAddressSnapshot,
        vendorRef: order.vendorRef, vendorName: order.vendorName, vendorAddressSnapshot: order.vendorAddressSnapshot,
        transportType: String(req.body.transportType || '').trim() || undefined, vehicleNumber: String(req.body.vehicleNumber || '').trim() || undefined, eWayBillNumber: String(req.body.eWayBillNumber || '').trim() || undefined,
        items, createdBy: req.user._id,
      }], { session });
      created = { challan, order: orderView(order, [...previous, challan]) };
    });
  } finally { await session.endSession(); }
  return res.status(201).json({ data: created });
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
