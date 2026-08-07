import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { deleteEmployee } from '../src/modules/hr/controllers/employee.controller.js';
import { AuthSession } from '../src/modules/auth/models/auth-session.model.js';
import { Employee } from '../src/modules/hr/models/employee.model.js';
import { User } from '../src/models/user.model.js';

const originals = { employeeFindById: Employee.findById, userFindByIdAndUpdate: User.findByIdAndUpdate, sessionFind: AuthSession.find, sessionUpdateMany: AuthSession.updateMany };

afterEach(() => {
  Employee.findById = originals.employeeFindById;
  User.findByIdAndUpdate = originals.userFindByIdAndUpdate;
  AuthSession.find = originals.sessionFind;
  AuthSession.updateMany = originals.sessionUpdateMany;
});

test('deleting an employee suspends the linked user and revokes active sessions', async () => {
  let deleted = false;
  let userUpdate;
  let revoked;
  Employee.findById = async () => ({ _id: 'employee-1', user: 'user-1', deleteOne: async () => { deleted = true; } });
  User.findByIdAndUpdate = async (...args) => { userUpdate = args; };
  AuthSession.find = () => ({ select() { return this; }, lean: async () => [] });
  AuthSession.updateMany = async (filter) => { revoked = filter; };
  const response = { json(body) { this.body = body; } };

  await deleteEmployee({ params: { id: 'employee-1' }, user: { _id: 'hr-1' }, get: () => '' }, response);

  assert.equal(deleted, true);
  assert.deepEqual(userUpdate, ['user-1', { status: 'suspended' }]);
  assert.deepEqual(revoked, { user: 'user-1', revokedAt: null });
  assert.equal(response.body.data.id, 'employee-1');
});
