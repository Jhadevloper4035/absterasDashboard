import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { getMyInventoryAccess } from '../src/modules/inventory/controllers/permissions.controller.js';
import { authorizeAppModule, authorizeInventoryModule } from '../src/modules/auth/middleware/auth.middleware.js';
import { InventoryPermission } from '../src/modules/inventory/models/permission.model.js';

const originalFind = InventoryPermission.find;
const originalFindOne = InventoryPermission.findOne;
const response = () => ({ json(body) { this.body = body; } });
afterEach(() => { InventoryPermission.find = originalFind; InventoryPermission.findOne = originalFindOne; });

test('inventory access ignores non-admin roles and HR access', async () => {
  InventoryPermission.find = () => ({ lean: async () => [] });
  const res = response();
  await getMyInventoryAccess({ user: { _id: 'user', role: 'sales', accessTypes: ['hr-management'] } }, res);
  assert.deepEqual(res.body.data, [
    { module: 'categories', access: 'none' }, { module: 'items', access: 'none' },
    { module: 'transactions', access: 'none' }, { module: 'reports', access: 'none' },
  ]);
});

test('inventory middleware accepts only an explicit sufficient permission', async () => {
  InventoryPermission.findOne = () => ({ select: () => ({ lean: async () => ({ access: 'manage' }) }) });
  const req = { method: 'POST', user: { _id: 'user', role: 'sales', accessTypes: ['hr-management'], modulePermissions: [{ module: 'inventory', access: 'manage' }] } };
  await authorizeInventoryModule('items', 'manage')(req, {}, (error) => assert.equal(error, undefined));
  assert.equal(req.inventoryAccess, 'manage');
});

test('laser cut access does not grant powder coating access', () => {
  const req = { user: { modulePermissions: [{ module: 'laser-cut', access: 'manage' }] } };
  let error;
  authorizeAppModule('laser-cut', 'manage')(req, {}, (result) => { error = result; });
  assert.equal(error, undefined);
  authorizeAppModule('powder-coating', 'manage')(req, {}, (result) => { error = result; });
  assert.equal(error?.statusCode, 403);
});

test('delivery challan access does not grant client access', () => {
  const req = { user: { modulePermissions: [{ module: 'challans', access: 'manage' }] } };
  let error;
  authorizeAppModule('challans', 'manage')(req, {}, (result) => { error = result; });
  assert.equal(error, undefined);
  authorizeAppModule('clients', 'manage')(req, {}, (result) => { error = result; });
  assert.equal(error?.statusCode, 403);
});

test('client access does not grant invoice access', () => {
  const req = { user: { modulePermissions: [{ module: 'clients', access: 'manage' }] } };
  let error;
  authorizeAppModule('clients', 'manage')(req, {}, (result) => { error = result; });
  assert.equal(error, undefined);
  authorizeAppModule('invoices', 'manage')(req, {}, (result) => { error = result; });
  assert.equal(error?.statusCode, 403);
});
