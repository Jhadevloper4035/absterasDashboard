import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { createChallan, deleteChallan, listChallans, processChallanForPdf } from '../src/modules/challans/controllers/challan.controller.js';
import { Challan } from '../src/modules/challans/models/challan.model.js';
import { InventoryItem } from '../src/modules/inventory/models/item.model.js';
import { StockTransaction } from '../src/modules/inventory/models/transaction.model.js';
import { ReturnProduct } from '../src/modules/returns/models/return-product.model.js';
import { LaserCutChallan } from '../src/modules/lasercut/models.js';
import { PowderCoatChallan } from '../src/modules/powdercoating/models.js';

const originalCreate = Challan.create;
const originalFind = Challan.find;
const originalFindById = Challan.findById;
const originalCountDocuments = Challan.countDocuments;
const originalItemFind = InventoryItem.find;
const originalItemFindOneAndUpdate = InventoryItem.findOneAndUpdate;
const originalItemUpdate = InventoryItem.findByIdAndUpdate;
const originalTransactionCreate = StockTransaction.create;
const originalReturnProductUpdate = ReturnProduct.findByIdAndUpdate;
const originalLaserCutFind = LaserCutChallan.find;
const originalPowderCoatFind = PowderCoatChallan.find;

afterEach(() => {
  Challan.create = originalCreate;
  Challan.find = originalFind;
  Challan.findById = originalFindById;
  Challan.countDocuments = originalCountDocuments;
  InventoryItem.find = originalItemFind;
  InventoryItem.findOneAndUpdate = originalItemFindOneAndUpdate;
  InventoryItem.findByIdAndUpdate = originalItemUpdate;
  StockTransaction.create = originalTransactionCreate;
  ReturnProduct.findByIdAndUpdate = originalReturnProductUpdate;
  LaserCutChallan.find = originalLaserCutFind;
  PowderCoatChallan.find = originalPowderCoatFind;
});

test('lists inventory, laser-cut, and powder-coating challans together', async () => {
  let query;
  const chain = { populate: () => chain, lean: async () => [{ _id: 'central-1', challanNumber: 'DC-1', challanDate: '2026-09-10', createdAt: '2026-09-10T10:00:00.000Z', transferType: 'delivery', client: { _id: 'client-1', name: 'Client' }, lineItems: [{}] }] };
  Challan.find = (value) => { query = value; return chain; };
  LaserCutChallan.find = () => ({ lean: async () => [{ _id: 'laser-1', challanNo: 'LC-1', challanDate: '2026-09-10', createdAt: '2026-09-10T11:00:00.000Z', type: 'OUT', clientRef: 'client-1', clientName: 'Client', vendorName: 'Laser vendor', orderRef: 'laser-order', items: [{}] }] });
  PowderCoatChallan.find = () => ({ lean: async () => [
    { _id: 'powder-1', challanNo: 'PC-1', challanDate: '2026-09-10', createdAt: '2026-09-10T14:00:00.000Z', type: 'SITE_OUT', clientRef: 'client-1', clientName: 'Client', vendorName: 'Powder vendor', orderRef: 'powder-order', items: [{}] },
    { _id: 'powder-2', challanNo: 'PC-2', challanDate: '2026-09-10', createdAt: '2026-09-10T13:00:00.000Z', type: 'OUT', clientRef: 'client-1', clientName: 'Client', vendorName: 'Powder vendor', orderRef: 'powder-order', items: [{ source: 'LASER_CUT' }] },
  ] });
  const response = { json(body) { this.body = body; return this; } };
  await listChallans({ query: { type: 'delivery' } }, response);
  assert.deepEqual(query, { transferType: 'delivery' });
  assert.equal(response.body.meta.total, 1);
  assert.equal(response.body.data[0].process, 'Inventory Delivery');

  await listChallans({ query: {} }, response);
  assert.equal(response.body.data[0].challanNumber, 'PC-1');

  await listChallans({ query: { type: 'powder_coating_to_client' } }, response);
  assert.equal(response.body.meta.total, 1);
  assert.equal(response.body.data[0].workflowLink, '/powder-coating-management/orders/powder-order');
  assert.equal(response.body.data[0].pdfPath, '/challans/powder-coating/powder-1/pdf');

  await listChallans({ query: { type: 'laser_cut_to_powder_coating' } }, response);
  assert.equal(response.body.meta.total, 1);
  assert.equal(response.body.data[0].challanNumber, 'PC-2');
});

test('process challan PDF uses the stored client, vendor, transport, and material snapshots', () => {
  const pdfChallan = processChallanForPdf({ challanNo: 'PC-1', challanDate: '2026-09-10', type: 'SITE_OUT', clientName: 'Client', clientSiteAddressSnapshot: 'Client site', vendorName: 'Powder vendor', vendorAddressSnapshot: 'Vendor address', transportType: 'Road', vehicleNumber: 'HR26AB1234', eWayBillNumber: 'EWAY-1', items: [{ itemName: 'Tube', hsnCode: '7608', quantity: 1, unit: 'pcs' }] });
  assert.equal(pdfChallan.client.name, 'Client');
  assert.equal(pdfChallan.pickupAddress, 'Vendor address');
  assert.deepEqual(pdfChallan.lineItems, [{ description: 'Tube', hsnCode: '7608', quantity: 1, unit: 'pcs' }]);
});

test('creates challans with a generated number', async () => {
  let created;
  Challan.create = async (payload) => { created = payload; return { _id: 'challan-1', ...payload }; };
  InventoryItem.find = () => ({ lean: async () => [{ _id: 'item-1', name: 'Bracket', category: 'hardware', hsnCode: '8302', unit: 'pcs' }] });
  InventoryItem.findOneAndUpdate = async () => ({ _id: 'item-1' });
  StockTransaction.create = async () => ({ _id: 'transaction-1' });
  const response = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await createChallan({ body: { challanNumber: 'MANUAL-1', client: 'client-1', supplier: 'supplier-1', challanDate: '2026-08-10', pickupAddress: 'Vendor Warehouse', hardwareOnly: true, lineItems: [{ inventoryItem: 'item-1', quantity: 2 }] }, user: { _id: 'user-1' } }, response);
  assert.equal(response.statusCode, 201);
  assert.match(created.challanNumber, /^DC-[A-F0-9]{10}$/);
  assert.equal(created.pickupAddress, 'Vendor Warehouse');
  assert.equal(created.supplier, 'supplier-1');
  assert.deepEqual(created.lineItems, [{ inventoryItem: 'item-1', description: 'Bracket', hsnCode: '8302', quantity: 2, unit: 'pcs' }]);
});

test('restores linked inventory when a challan is deleted', async () => {
  const updates = []; const transactions = []; let deleted = false;
  Challan.findById = async () => ({ _id: 'challan-1', challanNumber: 'DC-1234567890', lineItems: [{ inventoryItem: 'item-1', description: 'Bracket', quantity: 3 }], deleteOne: async () => { deleted = true; }, toObject: () => ({}) });
  InventoryItem.findByIdAndUpdate = async (item, update) => { updates.push({ item, update }); return { _id: item }; };
  StockTransaction.create = async (entry) => { transactions.push(entry); };
  const response = { statusCode: 200, status(code) { this.statusCode = code; return this; }, end() { this.ended = true; } };
  await deleteChallan({ params: { id: 'challan-1' }, user: { _id: 'user-1' } }, response);
  assert.equal(deleted, true);
  assert.deepEqual(updates, [{ item: 'item-1', update: { $inc: { quantityInStock: 3 } } }]);
  assert.equal(transactions[0].type, 'adjustment');
  assert.equal(response.statusCode, 204);
});

test('restores return storage when a return transfer challan is deleted', async () => {
  const updates = []; let deleted = false;
  Challan.findById = async () => ({ _id: 'challan-1', challanNumber: 'DC-1234567890', transferType: 'return_transfer', returnProducts: [{ product: 'return-product-1', quantity: 3 }], deleteOne: async () => { deleted = true; }, toObject: () => ({}) });
  ReturnProduct.findByIdAndUpdate = async (product, update) => { updates.push({ product, update }); return { _id: product }; };
  const response = { statusCode: 200, status(code) { this.statusCode = code; return this; }, end() { this.ended = true; } };
  await deleteChallan({ params: { id: 'challan-1' }, user: { _id: 'user-1' } }, response);
  assert.equal(deleted, true);
  assert.deepEqual(updates, [{ product: 'return-product-1', update: { $inc: { quantity: 3 }, $set: { status: 'stored' } } }]);
  assert.equal(response.statusCode, 204);
});
