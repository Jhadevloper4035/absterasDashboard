import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { createInvoice, updateInvoice } from '../src/modules/invoices/controllers/invoice.controller.js';
import { Invoice } from '../src/modules/invoices/models/invoice.model.js';

const originalCreate = Invoice.create;
const originalFindById = Invoice.findById;

function res() {
  return { statusCode: 200, body: undefined, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

afterEach(() => {
  Invoice.create = originalCreate;
  Invoice.findById = originalFindById;
});

test('creates and updates invoices with only documented fields', async () => {
  let created;
  Invoice.create = async (payload) => { created = payload; return { _id: 'invoice-1', ...payload }; };
  const createResponse = res();
  await createInvoice({ body: { invoiceNumber: '1/2026-27', financialYear: '2026-27', client: 'client-1', invoiceDate: '2026-04-04', taxableAmount: 100, grandTotal: 118, untrusted: true } }, createResponse);
  assert.equal(createResponse.statusCode, 201);
  assert.equal(created.untrusted, undefined);

  const invoice = { _id: 'invoice-1', save: async () => {} };
  Invoice.findById = async () => invoice;
  const updateResponse = res();
  await updateInvoice({ params: { id: 'invoice-1' }, body: { status: 'paid', untrusted: true } }, updateResponse);
  assert.equal(invoice.status, 'paid');
  assert.equal(invoice.untrusted, undefined);
});
