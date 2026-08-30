import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { listClients } from '../src/modules/clients/controllers/client.controller.js';
import { Client } from '../src/modules/clients/models/client.model.js';
import { listInvoices } from '../src/modules/invoices/controllers/invoice.controller.js';
import { Invoice } from '../src/modules/invoices/models/invoice.model.js';
import { listChallans } from '../src/modules/challans/controllers/challan.controller.js';
import { Challan } from '../src/modules/challans/models/challan.model.js';

const originals = {
  clientFind: Client.find, clientCount: Client.countDocuments,
  invoiceFind: Invoice.find, invoiceCount: Invoice.countDocuments,
  challanFind: Challan.find, challanCount: Challan.countDocuments,
};
const queryChain = () => ({ populate() { return this; }, sort() { return this; }, skip() { return this; }, limit: async () => [] });
const response = () => ({ json(body) { this.body = body; return this; } });

afterEach(() => {
  Client.find = originals.clientFind; Client.countDocuments = originals.clientCount;
  Invoice.find = originals.invoiceFind; Invoice.countDocuments = originals.invoiceCount;
  Challan.find = originals.challanFind; Challan.countDocuments = originals.challanCount;
});

test('filters client documents and sites by their parent client and optional site', async () => {
  const queries = [];
  Client.find = (query) => { queries.push(query); return queryChain(); };
  Invoice.find = (query) => { queries.push(query); return queryChain(); };
  Challan.find = (query) => { queries.push(query); return queryChain(); };
  Client.countDocuments = Invoice.countDocuments = Challan.countDocuments = async () => 0;

  await listClients({ query: { parentClient: 'client-1' } }, response());
  await listInvoices({ query: { client: 'client-1', site: 'site-1' } }, response());
  await listChallans({ query: { client: 'client-1', site: 'site-1' } }, response());

  assert.deepEqual(queries, [
    { parentClient: 'client-1' },
    { client: 'client-1', site: 'site-1' },
    { client: 'client-1', site: 'site-1' },
  ]);
});
