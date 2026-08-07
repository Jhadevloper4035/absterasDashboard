import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createInvoicePdf } from '../src/modules/invoices/services/invoice-pdf.service.js';

test('creates a PDF tax invoice', async () => {
  const pdf = await createInvoicePdf({ invoiceNumber: '1/2026-27', invoiceDate: '2026-04-01', client: { name: 'Acme' }, lineItems: [{ description: 'ALUMINIUM SHEET', quantity: 1, unit: 'NOS', unitPrice: 100, lineAmount: 100 }], taxableAmount: 100, igstAmount: 18, cgstAmount: 0, sgstAmount: 0, roundOff: 0, grandTotal: 118 });
  assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
});
