import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SiteExpense } from '../src/modules/designer/models/site-expense.model.js';

const values = { client: '507f1f77bcf86cd799439011', clientSite: '507f1f77bcf86cd799439012', category: 'Travel', title: 'Parking charge', remark: 'Paid for site visit parking', amount: 50, paymentScreenshot: { key: 'uploads/image/payment.png', contentType: 'image/png' }, createdBy: '507f1f77bcf86cd799439013' };

test('SiteExpense requires client/site except for Send Sample, plus category, status, positive amount, and payment screenshot image', async () => {
  await new SiteExpense(values).validate();
  assert.equal(new SiteExpense(values).status, 'pending');
  await new SiteExpense({ ...values, category: 'Send Sample', client: undefined, clientSite: undefined }).validate();
  await assert.rejects(() => new SiteExpense({ ...values, client: undefined }).validate(), /Path `client` is required/);
  await assert.rejects(() => new SiteExpense({ ...values, category: '' }).validate(), /Path `category` is required/);
  await assert.rejects(() => new SiteExpense({ ...values, status: 'unknown' }).validate(), /is not a valid enum value/);
  await assert.rejects(() => new SiteExpense({ ...values, amount: 0 }).validate(), /minimum allowed value/);
  await assert.rejects(() => new SiteExpense({ ...values, paymentScreenshot: { key: 'uploads/document/payment.pdf', contentType: 'application\/pdf' } }).validate(), /payment screenshot image/);
});
