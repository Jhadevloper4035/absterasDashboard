import assert from 'node:assert/strict';
import { test } from 'node:test';
import mongoose from 'mongoose';
import { Advance } from '../src/models/advance.model.js';

test('advance request starts pending and requires a monthly deduction', async () => {
  const advance = new Advance({ employee: new mongoose.Types.ObjectId(), amount: 500, reason: 'Emergency', deductionSchedule: { monthlyAmount: 100 } });
  await advance.validate();
  assert.equal(advance.status, 'pending');
  await assert.rejects(() => new Advance({ employee: new mongoose.Types.ObjectId(), amount: 500, reason: 'Emergency' }).validate(), /monthlyAmount/);
});
