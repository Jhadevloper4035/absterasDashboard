import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { approvePasswordResetRequest, createUser, deleteUser, getUser, listLoginHistory, listUsers, logoutAllUsers, logoutUser, requestPasswordReset, updateUser } from '../src/controllers/user.controller.js';
import { AuthSession } from '../src/modules/auth/models/auth-session.model.js';
import { BlockedToken } from '../src/modules/auth/models/blocked-token.model.js';
import { LoginHistory } from '../src/modules/auth/models/login-history.model.js';
import { User } from '../src/models/user.model.js';
import { RateLimit } from '../src/models/rate-limit.model.js';

const originalAuthSessionFind = AuthSession.find;
const originalAuthSessionUpdateMany = AuthSession.updateMany;
const originalBlockedTokenUpdateOne = BlockedToken.updateOne;
const originalExists = User.exists;
const originalFind = User.find;
const originalCountDocuments = User.countDocuments;
const originalFindById = User.findById;
const originalFindByIdAndUpdate = User.findByIdAndUpdate;
const originalCreate = User.create;
const originalDeleteOne = User.deleteOne;
const originalLoginHistoryFind = LoginHistory.find;
const originalLoginHistoryCountDocuments = LoginHistory.countDocuments;
const originalLoginHistoryUpdateMany = LoginHistory.updateMany;
const originalRateLimitDeleteOne = RateLimit.deleteOne;

function res() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

afterEach(() => {
  User.exists = originalExists;
  User.find = originalFind;
  User.countDocuments = originalCountDocuments;
  User.findById = originalFindById;
  User.findByIdAndUpdate = originalFindByIdAndUpdate;
  User.create = originalCreate;
  User.deleteOne = originalDeleteOne;
  AuthSession.find = originalAuthSessionFind;
  AuthSession.updateMany = originalAuthSessionUpdateMany;
  BlockedToken.updateOne = originalBlockedTokenUpdateOne;
  LoginHistory.find = originalLoginHistoryFind;
  LoginHistory.countDocuments = originalLoginHistoryCountDocuments;
  LoginHistory.updateMany = originalLoginHistoryUpdateMany;
  RateLimit.deleteOne = originalRateLimitDeleteOne;
});

function emptyActiveSessions() {
  AuthSession.find = () => ({
    sort() {
      return this;
    },
    limit() {
      return this;
    },
    populate() {
      return this;
    },
    lean() {
      return Promise.resolve([]);
    },
  });
}

test('initial setup can create the Superadmin account', async () => {
  User.create = async (user) => ({ _id: 'superadmin-1', ...user });

  const response = res();
  await createUser(
    {
      body: {
        name: 'Second Superadmin',
        email: 'superadmin2@example.com',
        phone: '9876543210',
        password: 'Secret123',
        role: 'superadmin',
      },
    },
    response,
  );

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.data.role, 'superadmin');
});

test('user creation requires mobile number', async () => {
  const response = res();
  await createUser(
    {
      body: {
        name: 'Sales User',
        email: 'sales@example.com',
        password: 'Secret123',
        role: 'sales',
      },
    },
    response,
  );

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.error.message, 'Mobile number is required');
});

test('employment details require Employee access type', async () => {
  const response = res();
  await createUser(
    {
      body: {
        name: 'Sales User', email: 'sales@example.com', phone: '9876543210', password: 'Secret123', role: 'sales',
        employment: { employeeType: 'office', department: 'department-1', designation: 'designation-1', joiningDate: '2026-08-01', monthlySalary: 50000 },
      },
    },
    response,
  );

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.error.message, 'Select the Employee work profile before adding employment details');
});

test('user creation rejects weak passwords', async () => {
  const response = res();
  await createUser(
    {
      body: {
        name: 'Sales User',
        email: 'sales@example.com',
        phone: '9876543210',
        password: 'password',
        role: 'sales',
      },
    },
    response,
  );

  assert.equal(response.statusCode, 400);
  assert.match(response.body.error.message, /letters and numbers/);
});

test('direct role changes are ignored when updating a user', async () => {
  User.findById = async () => ({ _id: 'sales-1', role: 'sales' });
  User.findByIdAndUpdate = async (id, update) => ({ _id: id, role: 'sales', ...update });

  const response = res();
  await updateUser(
    {
      params: { id: 'sales-1' },
      body: { role: 'superadmin' },
    },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.role, 'sales');
});

test('cannot demote the only superadmin', async () => {
  User.findById = async () => ({ _id: 'superadmin-1', role: 'superadmin' });
  User.exists = async () => null;

  const response = res();
  await updateUser(
    {
      params: { id: 'superadmin-1' },
      body: { role: 'sales' },
    },
    response,
  );

  assert.equal(response.statusCode, 403);
  assert.equal(response.body.error.message, 'Only Superadmin can manage the Superadmin account');
});

test('updating a user ignores the legacy role field', async () => {
  User.findById = async () => ({ _id: 'admin-1', role: 'admin' });
  User.exists = async () => ({ _id: 'admin-2' });
  User.findByIdAndUpdate = async (id, update) => {
    assert.equal(id, 'admin-1');
    assert.deepEqual(update, { name: 'Admin Updated' });
    return { _id: id, ...update };
  };

  const response = res();
  await updateUser(
    {
      user: { role: 'superadmin' },
      params: { id: 'admin-1' },
      body: { name: 'Admin Updated', role: 'admin' },
    },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.name, 'Admin Updated');
});

test('admin lists all user profiles', async () => {
  let filter;
  User.find = (value) => {
    filter = value;
    return {
      sort() {
        return this;
      },
      skip() {
        return this;
      },
      limit() {
        return Promise.resolve([]);
      },
    };
  };
  User.countDocuments = async () => 0;

  const response = res();
  await listUsers({ user: { role: 'admin' }, query: {} }, response);

  assert.deepEqual(filter, {});
  assert.deepEqual(response.body.data, []);
});

test('password reset requests store a hash instead of the requested password', async () => {
  let update;
  User.findByIdAndUpdate = async (id, value) => {
    assert.equal(id, 'sales-1');
    update = value;
  };

  const response = res();
  await requestPasswordReset({ user: { _id: 'sales-1', role: 'sales' }, body: { password: 'NewPassword1' } }, response);

  assert.equal(response.statusCode, 201);
  assert.match(update.$set.passwordResetPasswordHash, /^scrypt:/);
  assert.notEqual(update.$set.passwordResetPasswordHash, 'NewPassword1');
  assert.ok(update.$set.passwordResetRequestedAt instanceof Date);
  assert.equal(update.$push.passwordResetHistory.status, 'pending');
});

test('admin approval applies a requested password and clears the request', async () => {
  let update;
  User.findById = () => ({
    select() {
      return Promise.resolve({ _id: 'sales-1', role: 'sales', passwordResetPasswordHash: 'scrypt:reset:hash' });
    },
  });
  User.findByIdAndUpdate = async (id, value) => {
    assert.equal(id, 'sales-1');
    update = value;
  };
  RateLimit.deleteOne = async () => {};
  AuthSession.find = () => ({ select() { return this; }, lean: async () => [] });
  AuthSession.updateMany = async () => {};

  const response = res();
  await approvePasswordResetRequest({ user: { role: 'admin' }, params: { id: 'sales-1' } }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(update.$set.passwordHash, 'scrypt:reset:hash');
  assert.equal(update.$set['passwordResetHistory.$[request].status'], 'approved');
  assert.deepEqual(update.$unset, { passwordResetPasswordHash: 1, passwordResetRequestedAt: 1 });
});

test('user updates ignore legacy access types', async () => {
  User.findById = async () => ({ _id: 'sales-1', role: 'user', additionalRoles: [] });
  User.findByIdAndUpdate = async (id, update) => {
    assert.equal(id, 'sales-1');
    assert.deepEqual(update, {});
    return { _id: id, ...update, status: 'active' };
  };
  AuthSession.find = () => ({ select() { return this; }, lean: async () => [] });
  AuthSession.updateMany = async () => {};

  const response = res();
  await updateUser({ user: { _id: 'superadmin-1', role: 'superadmin' }, params: { id: 'sales-1' }, body: { accessTypes: ['accounts', 'sales', 'admin', 'hr'] } }, response);

  assert.equal(response.statusCode, 200);
});

test('employee HR access can be saved as none', async () => {
  const permissions = [
    { module: 'todo', access: 'manage' }, { module: 'notifications', access: 'manage' }, { module: 'leads', access: 'none' }, { module: 'tasks', access: 'none' },
    { module: 'hr', access: 'none' }, { module: 'clients', access: 'none' }, { module: 'inventory', access: 'none' }, { module: 'returns', access: 'none' },
  ];
  User.findById = async () => ({ _id: 'employee-1', role: 'sales', workProfile: 'employee', modulePermissions: permissions.map((permission) => permission.module === 'hr' ? { ...permission, access: 'view' } : permission) });
  User.findByIdAndUpdate = async (id, update) => {
    assert.equal(id, 'employee-1');
    assert.equal(update.modulePermissions.find((permission) => permission.module === 'hr')?.access, 'none');
    return { _id: id, ...update };
  };
  AuthSession.find = () => ({ select() { return this; }, lean: async () => [] });
  AuthSession.updateMany = async () => {};

  const response = res();
  await updateUser({ user: { role: 'superadmin' }, params: { id: 'employee-1' }, body: { modulePermissions: permissions } }, response);

  assert.equal(response.statusCode, 200);
});

test('access types are ignored when creating a standard user', async () => {
  const body = { name: 'Admin User', email: 'admin@example.com', phone: '9876543210', password: 'Secret123', role: 'sales', accessTypes: ['sales', 'admin'] };
  User.create = async (user) => ({ _id: 'user-1', ...user });

  const response = res();
  await createUser({ user: { role: 'admin' }, body }, response);

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.data.role, undefined);
  assert.equal(response.body.data.accessTypes, undefined);
});

test('only one admin work profile can be created', async () => {
  let filter;
  User.exists = async (value) => {
    filter = value;
    return { _id: 'admin-1' };
  };

  const response = res();
  await createUser({
    user: { role: 'superadmin' },
    body: { name: 'Second Admin', email: 'admin2@example.com', phone: '9876543210', password: 'Secret123', workProfile: 'admin' },
  }, response);

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.error.message, 'Only one admin is allowed');
  assert.ok(filter.$or.some((condition) => condition.workProfile === 'admin'));
});

test('a user cannot be promoted to a second admin work profile', async () => {
  User.findById = async () => ({ _id: 'user-2', role: 'user', workProfile: 'employee' });
  User.exists = async () => ({ _id: 'admin-1' });

  const response = res();
  await updateUser({ user: { role: 'superadmin' }, params: { id: 'user-2' }, body: { workProfile: 'admin' } }, response);

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.error.message, 'Only one admin is allowed');
});

test('admin login history can include every user role', async () => {
  let filter;
  emptyActiveSessions();
  LoginHistory.find = (value) => {
    filter = value;
    return {
      sort() {
        return this;
      },
      skip() {
        return this;
      },
      limit(value) {
        assert.equal(value, 25);
        return this;
      },
      populate() {
        return this;
      },
      lean() {
        return Promise.resolve([]);
      },
    };
  };
  LoginHistory.countDocuments = async () => 0;

  const response = res();
  await listLoginHistory({ user: { role: 'admin' }, query: {} }, response);

  assert.deepEqual(filter, {});
  assert.deepEqual(response.body.data, []);
});

test('admin can filter privileged user login history', async () => {
  let filter;
  let sessionFilter;
  User.findById = () => ({
    select() {
      return Promise.resolve({ _id: '507f1f77bcf86cd799439011', role: 'admin' });
    },
  });
  LoginHistory.find = (value) => {
    filter = value;
    return {
      sort() {
        return this;
      },
      skip() {
        return this;
      },
      limit() {
        return this;
      },
      populate() {
        return this;
      },
      lean() {
        return Promise.resolve([]);
      },
    };
  };
  LoginHistory.countDocuments = async () => 0;
  AuthSession.find = (value) => {
    sessionFilter = value;
    return {
      sort() {
        return this;
      },
      limit() {
        return this;
      },
      populate() {
        return this;
      },
      lean() {
        return Promise.resolve([]);
      },
    };
  };

  const response = res();
  await listLoginHistory({ user: { role: 'admin' }, query: { userId: '507f1f77bcf86cd799439011' } }, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(filter, { user: '507f1f77bcf86cd799439011' });
  assert.equal(String(sessionFilter.user), '507f1f77bcf86cd799439011');
});

test('users can only view their own login history', async () => {
  let filter;
  let sessionFilter;
  LoginHistory.find = (value) => {
    filter = value;
    return {
      sort() { return this; },
      skip() { return this; },
      limit() { return this; },
      populate() { return this; },
      lean() { return Promise.resolve([]); },
    };
  };
  LoginHistory.countDocuments = async () => 0;
  AuthSession.find = (value) => {
    sessionFilter = value;
    return {
      sort() { return this; },
      limit() { return this; },
      populate() { return this; },
      lean() { return Promise.resolve([]); },
    };
  };

  await listLoginHistory({ user: { _id: 'sales-1', role: 'sales' }, query: { userId: 'admin-1' } }, res());

  assert.deepEqual(filter, { user: 'sales-1' });
  assert.equal(String(sessionFilter.user), 'sales-1');
});

test('login history closes duplicate current rows for the same user', async () => {
  const user = { _id: 'user-1', name: 'Harpreet', email: 'harpreet@absteras.com', role: 'sales', status: 'active' };
  const newestLogin = new Date('2026-08-02T14:49:38.000Z');
  const oldLogin = new Date('2026-08-01T12:59:07.000Z');
  let closedHistoryFilter;

  AuthSession.find = () => ({
    sort() {
      return this;
    },
    skip() {
      return this;
    },
    limit() {
      return this;
    },
    populate() {
      return this;
    },
    lean() {
      return Promise.resolve([{ _id: 'session-1', user, createdAt: newestLogin, ipAddress: '127.0.0.1', userAgent: 'Chrome' }]);
    },
  });
  LoginHistory.countDocuments = async () => 2;
  AuthSession.updateMany = async () => {};
  LoginHistory.find = () => ({
    sort() {
      return this;
    },
    skip() {
      return this;
    },
    limit() {
      return this;
    },
    populate() {
      return this;
    },
    lean() {
      return Promise.resolve([
        { _id: 'history-new', user, email: user.email, role: user.role, loggedInAt: newestLogin, ipAddress: '127.0.0.1', userAgent: 'Chrome' },
        { _id: 'history-old', user, email: user.email, role: user.role, loggedInAt: oldLogin, ipAddress: '127.0.0.1', userAgent: 'Chrome' },
      ]);
    },
  });
  LoginHistory.updateMany = async (filter) => {
    closedHistoryFilter = filter;
  };

  const response = res();
  await listLoginHistory({ user: { role: 'admin' }, query: {} }, response);

  assert.deepEqual(closedHistoryFilter, { _id: { $in: ['history-old'] } });
  assert.equal(response.body.data.filter((item) => !item.logoutAt).length, 1);
  assert.equal(response.body.data.find((item) => item._id === 'history-old').logoutReason, 'new_login');
});

test('admin can logout an active user from login history', async () => {
  let sessionUpdate;
  let historyUpdate;
  const userId = '507f1f77bcf86cd799439011';

  User.findById = (id) => ({
    select(field) {
      assert.equal(id, userId);
      assert.equal(field, 'role status');
      return Promise.resolve({ _id: userId, role: 'sales', status: 'active' });
    },
  });
  AuthSession.find = (filter) => {
    assert.equal(filter.user, userId);
    return {
      select() {
        return this;
      },
      lean() {
        return Promise.resolve([{ accessTokenJti: 'access-1' }]);
      },
    };
  };
  AuthSession.updateMany = async (filter, update) => {
    sessionUpdate = { filter, update };
  };
  BlockedToken.updateOne = async () => {};
  LoginHistory.updateMany = async (filter, update) => {
    historyUpdate = { filter, update };
  };

  const response = res();
  await logoutUser({ user: { _id: 'admin-1', role: 'admin' }, params: { id: userId }, get: () => '', ip: '127.0.0.1' }, response);

  assert.equal(response.body.data.ok, true);
  assert.deepEqual(sessionUpdate.filter, { user: userId, revokedAt: null });
  assert.deepEqual(historyUpdate.filter, { user: userId, logoutAt: null });
  assert.ok(historyUpdate.update.$set.logoutAt instanceof Date);
  assert.equal(historyUpdate.update.$set.logoutReason, 'logout');
});

test('admin can logout all active users', async () => {
  let sessionUpdate;
  let historyUpdate;

  AuthSession.find = (filter) => {
    assert.equal(filter.revokedAt, null);
    return {
      select(field) {
        assert.equal(field, 'accessTokenJti user');
        return this;
      },
      lean() {
        return Promise.resolve([
          { accessTokenJti: 'access-1', user: 'user-1' },
          { accessTokenJti: 'access-2', user: 'user-2' },
        ]);
      },
    };
  };
  AuthSession.updateMany = async (filter, update) => {
    sessionUpdate = { filter, update };
  };
  const blockedTokens = [];
  BlockedToken.updateOne = async (filter, update) => {
    blockedTokens.push({ filter, update });
  };
  LoginHistory.updateMany = async (filter, update) => {
    historyUpdate = { filter, update };
  };

  const response = res();
  await logoutAllUsers({ user: { _id: 'admin-1', role: 'admin' }, get: () => '', ip: '127.0.0.1' }, response);

  assert.equal(response.body.data.ok, true);
  assert.equal(response.body.data.revokedSessions, 2);
  assert.deepEqual(sessionUpdate.filter, { revokedAt: null });
  assert.equal(blockedTokens.length, 2);
  assert.deepEqual(historyUpdate.filter, { logoutAt: null });
  assert.ok(historyUpdate.update.$set.logoutAt instanceof Date);
  assert.equal(historyUpdate.update.$set.logoutReason, 'logout');
});

test('admin can create standard users', async () => {
  User.exists = async () => null;
  User.create = async (user) => ({ _id: 'operations-1', role: user.role, email: user.email });

  const response = res();
  await createUser(
    {
      user: { role: 'admin' },
      body: {
        name: 'Operations User',
        email: 'operations@example.com',
        phone: '9876543210',
        password: 'Secret123',
        role: 'operations',
      },
    },
    response,
  );

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.data.role, undefined);
});

test('admin cannot create the Superadmin account', async () => {
  const response = res();
  await createUser(
    {
      user: { role: 'admin' },
      body: {
        name: 'New Superadmin',
        email: 'superadmin@example.com',
        phone: '9876543210',
        password: 'Secret123',
        role: 'superadmin',
      },
    },
    response,
  );

  assert.equal(response.statusCode, 403);
  assert.equal(response.body.error.message, 'Only initial setup can create the Superadmin account');
});

test('admin cannot assign Superadmin as an access type', async () => {
  const response = res();
  await createUser(
    {
      user: { role: 'admin' },
      body: {
        name: 'Sales User',
        email: 'sales@example.com',
        phone: '9876543210',
        password: 'Secret123',
        role: 'sales',
        accessTypes: ['sales', 'superadmin'],
      },
    },
    response,
  );

  assert.equal(response.statusCode, 403);
  assert.equal(response.body.error.message, 'Only initial setup can create the Superadmin account');
});

test('only Superadmin can assign the Superadmin work profile', async () => {
  const response = res();
  await createUser(
    {
      user: { role: 'admin' },
      body: {
        name: 'New Superadmin',
        email: 'superadmin-profile@example.com',
        phone: '9876543210',
        password: 'Secret123',
        workProfile: 'superadmin',
      },
    },
    response,
  );

  assert.equal(response.statusCode, 403);
  assert.equal(response.body.error.message, 'Only Superadmin can assign the Superadmin profile');
});

test('admin can read another admin profile', async () => {
  User.findById = async () => ({ _id: 'admin-2', role: 'admin' });

  const response = res();
  await getUser({ user: { role: 'admin' }, params: { id: 'admin-2' } }, response);

  assert.equal(response.statusCode, 200);
});

test('legacy role changes are ignored for admins', async () => {
  User.findById = async () => ({ _id: 'sales-1', role: 'sales' });
  User.findByIdAndUpdate = async (id, update) => ({ _id: id, role: 'sales', ...update });

  const response = res();
  await updateUser(
    {
      user: { role: 'admin' },
      params: { id: 'sales-1' },
      body: { role: 'admin' },
    },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.role, 'sales');
});

test('updates user display name without changing assignment identity', async () => {
  User.findById = async () => ({ _id: 'sales-1', role: 'sales' });
  User.findByIdAndUpdate = async (id, update) => {
    assert.equal(id, 'sales-1');
    assert.deepEqual(update, { name: 'Updated Name' });
    return { _id: id, role: 'sales', name: update.name };
  };

  const response = res();
  await updateUser(
    {
      user: { role: 'admin' },
      params: { id: 'sales-1' },
      body: { name: 'Updated Name' },
    },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data._id, 'sales-1');
  assert.equal(response.body.data.name, 'Updated Name');
});

test('updates extended user profile fields from the User model', async () => {
  User.findById = async () => ({ _id: 'sales-1', role: 'sales' });
  User.findByIdAndUpdate = async (id, update, options) => {
    assert.equal(id, 'sales-1');
    assert.deepEqual(update, {
      whatsappNumber: '+971500000001',
      territories: ['Dubai', 'Abu Dhabi'],
      notificationPreferences: {
        inApp: true,
        whatsapp: true,
        morningSummary: { enabled: true, time: '08:30' },
      },
    });
    assert.equal(options.runValidators, true);
    return { _id: id, role: 'sales', ...update };
  };

  const response = res();
  await updateUser(
    {
      user: { role: 'admin' },
      params: { id: 'sales-1' },
      body: {
        whatsappNumber: '+971500000001',
        territories: 'Dubai, Abu Dhabi, ',
        notificationPreferences: {
          inApp: true,
          whatsapp: true,
          morningSummary: { enabled: true, time: '08:30' },
        },
      },
    },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body.data.territories, ['Dubai', 'Abu Dhabi']);
});

test('user updates ignore fields outside the editable profile allowlist', async () => {
  User.findById = async () => ({ _id: 'sales-1', role: 'sales' });
  User.findByIdAndUpdate = async (_id, update) => {
    assert.deepEqual(update, { name: 'Sales User' });
    return { _id, role: 'sales', name: update.name };
  };

  const response = res();
  await updateUser(
    {
      user: { role: 'admin' },
      params: { id: 'sales-1' },
      body: { name: 'Sales User', passwordHash: 'bad', permissions: ['superadmin'], tokenVersion: 999 },
    },
    response,
  );

  assert.equal(response.statusCode, 200);
});

test('users cannot delete their own account', async () => {
  User.findById = async () => ({ _id: 'admin-1', role: 'admin', status: 'active' });

  const response = res();
  await deleteUser({ user: { _id: 'admin-1', role: 'admin' }, params: { id: 'admin-1' } }, response);

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.error.message, 'You cannot delete your own account');
});

test('development hard delete removes the requested user', async () => {
  User.findById = async () => ({ _id: 'sales-1', role: 'sales', status: 'inactive' });
  User.deleteOne = async (filter) => { assert.deepEqual(filter, { _id: 'sales-1' }); };
  AuthSession.find = () => ({ select() { return this; }, lean: async () => [] });
  AuthSession.updateMany = async () => {};

  const response = res();
  await deleteUser({ user: { _id: 'superadmin-1', role: 'superadmin' }, params: { id: 'sales-1' }, query: { hard: 'true' } }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.hardDeleted, true);
});
