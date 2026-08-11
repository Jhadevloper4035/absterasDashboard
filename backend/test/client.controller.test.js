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
