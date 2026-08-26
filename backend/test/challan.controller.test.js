import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { createChallan, deleteChallan } from '../src/modules/challans/controllers/challan.controller.js';
import { Challan } from '../src/modules/challans/models/challan.model.js';
import { InventoryItem } from '../src/modules/inventory/models/item.model.js';
import { StockTransaction } from '../src/modules/inventory/models/transaction.model.js';

const originalCreate = Challan.create;
const originalFindById = Challan.findById;
const originalItemUpdate = InventoryItem.findByIdAndUpdate;
const originalTransactionCreate = StockTransaction.create;

afterEach(() => {
  Challan.create = originalCreate;
  Challan.findById = originalFindById;
  InventoryItem.findByIdAndUpdate = originalItemUpdate;
  StockTransaction.create = originalTransactionCreate;
});

test('creates challans with a generated number', async () => {
  let created;
  Challan.create = async (payload) => { created = payload; return { _id: 'challan-1', ...payload }; };
  const response = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await createChallan({ body: { challanNumber: 'MANUAL-1', client: 'client-1', challanDate: '2026-08-10', taxableAmount: 100, totalAmount: 118 } }, response);
  assert.equal(response.statusCode, 201);
  assert.match(created.challanNumber, /^DC-[A-F0-9]{10}$/);
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
