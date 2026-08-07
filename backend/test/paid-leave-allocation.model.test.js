import assert from 'node:assert/strict';
import { test } from 'node:test';
import mongoose from 'mongoose';
import { PaidLeaveAllocation } from '../src/models/paid-leave-allocation.model.js';

test('paid leave allocation requires one employee, month, and request', async () => {
  await assert.rejects(() => new PaidLeaveAllocation({}).validate(), /Path `employee` is required/);
  const allocation = new PaidLeaveAllocation({ employee: new mongoose.Types.ObjectId(), month: '2026-08', request: new mongoose.Types.ObjectId() });
  await allocation.validate();
  assert.equal(allocation.month, '2026-08');
});

test('paid leave allocation has one slot per employee and month', () => {
  assert.deepEqual(PaidLeaveAllocation.schema.indexes().find(([fields]) => fields.employee === 1 && fields.month === 1), [{ employee: 1, month: 1 }, { unique: true }]);
});
