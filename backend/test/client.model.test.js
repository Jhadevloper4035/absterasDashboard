import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Client } from '../src/modules/clients/models/client.model.js';

test('client combines billing and site details in one record', async () => {
  const client = new Client({ name: 'Kishori Lal Goel', gstin: '09abcde1234f1z5', billingAddress: 'Lucknow', shippingAddress: 'Lucknow', state: 'Uttar Pradesh', stateCode: '09', siteName: 'Emaar Gomti Green A2-19', siteAddress: 'Gomti Nagar', status: 'on hold', estimatedValue: 250000 });

  await client.validate();
  assert.equal(client.gstin, '09ABCDE1234F1Z5');
  assert.equal(client.siteName, 'Emaar Gomti Green A2-19');
  assert.equal(client.status, 'on hold');
});

test('client requires a name and a two-digit state code when supplied', async () => {
  await assert.rejects(() => new Client({ stateCode: '9' }).validate(), /Path `name` is required/);
  await assert.rejects(() => new Client({ name: 'Acme', stateCode: '999' }).validate(), /Path `stateCode` is invalid/);
});
