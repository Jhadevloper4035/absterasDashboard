import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { createClient, updateClient } from '../src/modules/clients/controllers/client.controller.js';
import { Client } from '../src/modules/clients/models/client.model.js';

const originalCreate = Client.create;
const originalFindById = Client.findById;
const originalExists = Client.exists;

function res() {
  return { statusCode: 200, body: undefined, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

afterEach(() => {
  Client.create = originalCreate;
  Client.findById = originalFindById;
  Client.exists = originalExists;
});

test('rejects a site whose parent client does not exist', async () => {
  Client.exists = async () => null;
  const response = res();
  await createClient({ body: { name: 'Tower A', parentClient: '507f1f77bcf86cd799439011' } }, response);
  assert.equal(response.statusCode, 400);
  assert.equal(response.body.error.message, 'Parent client not found');
});

test('requires an address for a child site', async () => {
  Client.exists = async () => ({ _id: 'parent-1' });
  const response = res();
  await createClient({ body: { name: 'Tower A', parentClient: '507f1f77bcf86cd799439011' } }, response);
  assert.equal(response.statusCode, 400);
  assert.equal(response.body.error.message, 'Site address is required for a child site');
});

test('uses a site address for the child billing and shipping address', async () => {
  let created;
  Client.exists = async (query) => query.siteAddress ? null : { _id: 'parent-1' };
  Client.create = async (payload) => { created = payload; return { _id: 'site-1', ...payload }; };
  await createClient({ body: { name: 'Tower A', parentClient: '507f1f77bcf86cd799439011', siteAddress: '12 Main Street' } }, res());
  assert.equal(created.billingAddress, '12 Main Street');
  assert.equal(created.shippingAddress, '12 Main Street');
});

test('rejects a duplicate site address for the same client', async () => {
  Client.exists = async (query) => query.siteAddress ? { _id: 'site-1' } : { _id: 'parent-1' };
  const response = res();
  await createClient({ body: { name: 'Tower B', parentClient: '507f1f77bcf86cd799439011', siteAddress: '12 Main Street' } }, response);
  assert.equal(response.statusCode, 409);
  assert.equal(response.body.error.message, 'This site address already exists for the client');
});

test('creates and updates only documented client fields', async () => {
  let created;
  Client.create = async (payload) => { created = payload; return { _id: 'client-1', ...payload }; };
  const createResponse = res();
  await createClient({ body: { name: 'Acme', siteName: 'Tower A', untrusted: true } }, createResponse);
  assert.equal(createResponse.statusCode, 201);
  assert.equal(created.untrusted, undefined);

  const client = { _id: 'client-1', name: 'Acme', save: async () => {} };
  Client.findById = async () => client;
  const updateResponse = res();
  await updateClient({ params: { id: 'client-1' }, body: { status: 'completed', untrusted: true } }, updateResponse);
  assert.equal(client.status, 'completed');
  assert.equal(client.untrusted, undefined);
});
