import assert from 'node:assert/strict';
import { test } from 'node:test';
import mongoose from 'mongoose';
import { ExpenseClaim } from '../src/modules/hr/models/expense-claim.model.js';

test('expense claim requires a payment screenshot and note', async () => {
  await assert.rejects(() => new ExpenseClaim({ employee: new mongoose.Types.ObjectId(), category: 'Travel', amount: 100, note: 'Airport taxi' }).validate(), /At least one payment screenshot is required/);
  await assert.rejects(() => new ExpenseClaim({ employee: new mongoose.Types.ObjectId(), category: 'Travel', amount: 100, receipts: [{ key: 'uploads/image/receipt.png', contentType: 'image/png' }] }).validate(), /Path `note` is required/);
});
