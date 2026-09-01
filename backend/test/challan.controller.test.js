import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { createChallan, deleteChallan, listChallans } from '../src/modules/challans/controllers/challan.controller.js';
import { Challan } from '../src/modules/challans/models/challan.model.js';
import { InventoryItem } from '../src/modules/inventory/models/item.model.js';
import { StockTransaction } from '../src/modules/inventory/models/transaction.model.js';
import { ReturnProduct } from '../src/modules/returns/models/return-product.model.js';

const originalCreate = Challan.create;
const originalFind = Challan.find;
const originalFindById = Challan.findById;
const originalCountDocuments = Challan.countDocuments;
const originalItemFind = InventoryItem.find;
const originalItemFindOneAndUpdate = InventoryItem.findOneAndUpdate;
const originalItemUpdate = InventoryItem.findByIdAndUpdate;
const originalTransactionCreate = StockTransaction.create;
const originalReturnProductUpdate = ReturnProduct.findByIdAndUpdate;

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
});

test('filters delivery challans by their stored type', async () => {
  let query;
  const chain = { populate: () => chain, sort: () => chain, skip: () => chain, limit: async () => [] };
  Challan.find = (value) => { query = value; return chain; };
  Challan.countDocuments = async () => 0;
  const response = { json(body) { this.body = body; return this; } };
  await listChallans({ query: { type: 'delivery' } }, response);
  assert.deepEqual(query, { transferType: 'delivery' });
  assert.equal(response.body.meta.total, 0);
});

test('creates challans with a generated number', async () => {
  let created;
  Challan.create = async (payload) => { created = payload; return { _id: 'challan-1', ...payload }; };
  InventoryItem.find = () => ({ lean: async () => [{ _id: 'item-1', name: 'Bracket', hsnCode: '8302', unit: 'pcs' }] });
  InventoryItem.findOneAndUpdate = async () => ({ _id: 'item-1' });
  StockTransaction.create = async () => ({ _id: 'transaction-1' });
  const response = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await createChallan({ body: { challanNumber: 'MANUAL-1', client: 'client-1', supplier: 'supplier-1', challanDate: '2026-08-10', pickupAddress: 'Vendor Warehouse', lineItems: [{ inventoryItem: 'item-1', quantity: 2 }] }, user: { _id: 'user-1' } }, response);
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
