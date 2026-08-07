import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { getHrPermissions, updateHrPermissions } from '../src/controllers/hr-permission.controller.js';
import { HR_MODULES, HrPermission } from '../src/models/hr-permission.model.js';
import { User } from '../src/models/user.model.js';

const originalExists = User.exists;
const originalFind = HrPermission.find;
const originalFindOneAndUpdate = HrPermission.findOneAndUpdate;

function res() {
  return { statusCode: 200, body: undefined, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

afterEach(() => {
  User.exists = originalExists;
  HrPermission.find = originalFind;
  HrPermission.findOneAndUpdate = originalFindOneAndUpdate;
});

test('HR permissions default every module to none', async () => {
  User.exists = async () => true;
  HrPermission.find = () => ({ lean: async () => [{ module: 'attendance', access: 'manage' }] });
  const response = res();

  await getHrPermissions({ params: { userId: '507f1f77bcf86cd799439011' } }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.length, HR_MODULES.length);
  assert.deepEqual(response.body.data.find((item) => item.module === 'attendance'), { module: 'attendance', access: 'manage' });
  assert.deepEqual(response.body.data.find((item) => item.module === 'payroll'), { module: 'payroll', access: 'none' });
});

test('HR permissions reject unknown modules', async () => {
  User.exists = async () => true;
  const response = res();

  await updateHrPermissions({ params: { userId: '507f1f77bcf86cd799439011' }, body: { permissions: [{ module: 'everything', access: 'manage' }] }, user: { _id: '507f1f77bcf86cd799439012' } }, response);

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.error.message, 'Invalid permissions');
});

test('HR permission updates write a full module set', async () => {
  User.exists = async () => true;
  const calls = [];
  HrPermission.findOneAndUpdate = async (filter, update) => { calls.push({ filter, update }); };
  const response = res();

  await updateHrPermissions({ params: { userId: '507f1f77bcf86cd799439011' }, body: { permissions: [{ module: 'attendance', access: 'manage' }] }, user: { _id: '507f1f77bcf86cd799439012' } }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(calls.length, HR_MODULES.length);
  assert.deepEqual(calls.find((call) => call.filter.module === 'attendance').update, { access: 'manage', grantedBy: '507f1f77bcf86cd799439012' });
  assert.deepEqual(calls.find((call) => call.filter.module === 'payroll').update, { access: 'none', grantedBy: '507f1f77bcf86cd799439012' });
});
