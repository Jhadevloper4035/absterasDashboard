import assert from 'node:assert/strict';
import test from 'node:test';
import { transportationCostFrom } from '../src/helpers/transportation-cost.js';

test('transportation cost stores the third-party payment without GST', () => {
  assert.deepEqual(transportationCostFrom({ transportationCost: '1000.555' }), { transportationCost: 1000.56 });
  assert.throws(() => transportationCostFrom({ transportationCost: -1 }), /zero or greater/);
});
