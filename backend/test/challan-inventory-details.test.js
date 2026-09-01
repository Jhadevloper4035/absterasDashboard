import assert from 'node:assert/strict';
import test from 'node:test';
import { inventoryLineFor } from '../src/modules/challans/controllers/challan.controller.js';

test('delivery challan line details are copied from inventory without pricing', () => {
  const line = inventoryLineFor({ _id: 'inventory-id', name: '8 x 4 Sheet', hsnCode: '4411', unit: 'sheet', unitCost: 1250 }, { quantity: 2, hsnCode: 'wrong', rate: 1 });
  assert.deepEqual(line, { inventoryItem: 'inventory-id', description: '8 x 4 Sheet', hsnCode: '4411', quantity: 2, unit: 'sheet' });
});
