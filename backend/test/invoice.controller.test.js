import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { createInvoice, listInvoices, updateInvoice } from '../src/modules/invoices/controllers/invoice.controller.js';
import { Invoice } from '../src/modules/invoices/models/invoice.model.js';

const originalCreate = Invoice.create;
const originalFind = Invoice.find;
const originalFindById = Invoice.findById;
const originalCountDocuments = Invoice.countDocuments;

function res() {
  return { statusCode: 200, body: undefined, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

afterEach(() => {
  Invoice.create = originalCreate;
  Invoice.find = originalFind;
  Invoice.findById = originalFindById;
  Invoice.countDocuments = originalCountDocuments;
});

test('creates invoices with a generated number and only documented fields', async () => {
  let created;
  Invoice.create = async (payload) => { created = payload; return { _id: 'invoice-1', ...payload }; };
  const createResponse = res();
  await createInvoice({ body: { invoiceNumber: 'ABS-2026-27-1234567890', financialYear: '2026-27', client: 'client-1', invoiceDate: '2026-04-04', poNumber: 'PO-123', poDate: '2026-04-01', dispatchFromAddress: 'Warehouse A', taxableAmount: 100, grandTotal: 118, untrusted: true } }, createResponse);
  assert.equal(createResponse.statusCode, 201);
  assert.equal(created.untrusted, undefined);
  assert.equal(created.invoiceNumber, 'ABS-2026-27-1234567890');
  assert.equal(created.dispatchFromAddress, 'Warehouse A');
  assert.equal(created.poNumber, 'PO-123');

  const invoice = { _id: 'invoice-1', save: async () => {} };
  Invoice.findById = async () => invoice;
  const updateResponse = res();
  await updateInvoice({ params: { id: 'invoice-1' }, body: { status: 'paid', untrusted: true } }, updateResponse);
  assert.equal(invoice.status, 'paid');
  assert.equal(invoice.untrusted, undefined);
});

test('lists newest invoices by creation time when requested', async () => {
  let sort;
  Invoice.find = () => ({ populate() { return this; }, sort(value) { sort = value; return this; }, skip() { return this; }, limit: async () => [] });
  Invoice.countDocuments = async () => 0;
  await listInvoices({ query: { sort: 'createdAt' } }, res());
  assert.deepEqual(sort, { createdAt: -1 });
});
