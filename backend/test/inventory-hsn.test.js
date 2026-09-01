import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_HSN_CODE, InventoryItem } from '../src/modules/inventory/models/item.model.js';

test('inventory products default to the temporary HSN code', async () => {
  const item = new InventoryItem({ sku: 'HSN-DEFAULT-1', category: 'hardware', name: 'Test product' });
  await item.validate();
  assert.equal(item.hsnCode, DEFAULT_HSN_CODE);
});
