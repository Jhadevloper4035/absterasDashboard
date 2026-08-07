import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Invoice } from '../src/modules/invoices/models/invoice.model.js';

const client = '507f1f77bcf86cd799439011';

test('invoice stores the supplied tax-invoice fields and line items', async () => {
  const invoice = new Invoice({ invoiceNumber: '1/2026-27', financialYear: '2026-27', client, invoiceDate: '2026-04-04', grRrNumber: 'GR-1', transport: 'Road', placeOfSupply: 'Uttar Pradesh', placeOfSupplyCode: '09', vehicleNumber: 'hr26ab1234', station: 'Gurugram', lineItems: [{ description: 'ALUMINIUM SHEET', hsnCode: '7606', quantity: 1, unit: 'NOS', unitPrice: 842347.46, lineAmount: 842347.46 }], taxableAmount: 842347.46, igstAmount: 151622.54, roundOff: -0.0, grandTotal: 993970, status: 'unpaid' });

  await invoice.validate();
  assert.equal(invoice.lineItems[0].description, 'ALUMINIUM SHEET');
  assert.equal(invoice.placeOfSupplyCode, '09');
  assert.equal(invoice.vehicleNumber, 'HR26AB1234');
  assert.equal(invoice.status, 'unpaid');
});

test('invoice requires its core header and total fields', async () => {
  await assert.rejects(() => new Invoice({ invoiceNumber: '1/2026-27' }).validate(), /Path `financialYear` is required/);
  await assert.rejects(() => new Invoice({ invoiceNumber: '1', financialYear: '2026-27', client, invoiceDate: '2026-04-04', taxableAmount: 1, grandTotal: 1, placeOfSupplyCode: '9' }).validate(), /Path `placeOfSupplyCode` is invalid/);
});
