import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { AuthSession } from '../src/modules/auth/models/auth-session.model.js';
import { BlockedToken } from '../src/modules/auth/models/blocked-token.model.js';
import { LoginHistory } from '../src/modules/auth/models/login-history.model.js';
import { RateLimit } from '../src/models/rate-limit.model.js';
import { User } from '../src/models/user.model.js';
import { env } from '../src/config/env.js';
import { cleanIpAddress } from '../src/helpers/request-ip.js';
import { allowFirstSuperadminOrUserManager, appAccessLevel, authorizeAppModule, authorizeHrModule, authorizeRoles, userRoles } from '../src/modules/auth/middleware/auth.middleware.js';
import { rateLimit } from '../src/middleware/rate-limit.middleware.js';
import { login, logout } from '../src/modules/auth/controllers/auth.controller.js';
import { clearFailedLoginAttempts, recordFailedLoginAttempt, setLoginAttemptStoreForTest } from '../src/modules/auth/services/login-attempt.service.js';
import { createAccessTokenPair, createSession, isAccessTokenBlocked, rotateSession } from '../src/modules/auth/services/auth-session.service.js';
import { hashPassword, verifyPassword } from '../src/modules/auth/services/password.service.js';
import { createAccessToken, hashRefreshToken, verifyAccessToken } from '../src/modules/auth/services/token.service.js';

const testReq = (userAgent = 'node-test', ip = '127.0.0.1') => ({
  ip,
  get: (name) => (String(name).toLowerCase() === 'user-agent' ? userAgent : ''),
});

const originals = {
  authCreate: AuthSession.create,
  authExists: AuthSession.exists,
  authFind: AuthSession.find,
  authFindOne: AuthSession.findOne,
  authFindOneAndUpdate: AuthSession.findOneAndUpdate,
  authUpdateMany: AuthSession.updateMany,
  blockedExists: BlockedToken.exists,
  blockedUpdateOne: BlockedToken.updateOne,
  loginHistoryCreate: LoginHistory.create,
  loginHistoryFindOneAndUpdate: LoginHistory.findOneAndUpdate,
  loginHistoryUpdateMany: LoginHistory.updateMany,
  rateFindOne: RateLimit.findOne,
  rateFindOneAndUpdate: RateLimit.findOneAndUpdate,
  rateDeleteOne: RateLimit.deleteOne,
  userFindOne: User.findOne,
  userUpdateOne: User.updateOne,
};

const loginAttemptStore = {
  increment: async () => 1,
  delete: async () => {},
};

setLoginAttemptStoreForTest(loginAttemptStore);

afterEach(() => {
  AuthSession.create = originals.authCreate;
  AuthSession.exists = originals.authExists;
  AuthSession.find = originals.authFind;
  AuthSession.findOne = originals.authFindOne;
  AuthSession.findOneAndUpdate = originals.authFindOneAndUpdate;
  AuthSession.updateMany = originals.authUpdateMany;
  BlockedToken.exists = originals.blockedExists;
  BlockedToken.updateOne = originals.blockedUpdateOne;
  LoginHistory.create = originals.loginHistoryCreate;
  LoginHistory.findOneAndUpdate = originals.loginHistoryFindOneAndUpdate;
  LoginHistory.updateMany = originals.loginHistoryUpdateMany;
  RateLimit.findOne = originals.rateFindOne;
  RateLimit.findOneAndUpdate = originals.rateFindOneAndUpdate;
  RateLimit.deleteOne = originals.rateDeleteOne;
  User.findOne = originals.userFindOne;
  User.updateOne = originals.userUpdateOne;
  setLoginAttemptStoreForTest(loginAttemptStore);
});

test('password hashing verifies only the original password', async () => {
  const hash = await hashPassword('Secret123');

  assert.equal(await verifyPassword('Secret123', hash), true);
  assert.equal(await verifyPassword('wrong-password', hash), false);
});

test('ip address display removes ipv6 mapped prefix', () => {
  assert.equal(cleanIpAddress('::ffff:172.26.0.1'), '172.26.0.1');
  assert.equal(cleanIpAddress('203.0.113.10, 10.0.0.1'), '203.0.113.10');
});

test('role authorization accepts an assigned additional business role', () => {
  let nextError;
  authorizeRoles('sales')({ user: { role: 'accounts', additionalRoles: ['sales'] } }, {}, (error) => { nextError = error; });
  assert.equal(nextError, undefined);
});

test('Superadmin work profile has full module access', () => {
  const user = { workProfile: 'superadmin' };
  assert.ok(userRoles(user).includes('superadmin'));
  assert.equal(appAccessLevel(user, 'inventory'), 2);

  let nextError;
  authorizeRoles('superadmin')({ user }, {}, (error) => { nextError = error; });
  assert.equal(nextError, undefined);
});

test('module permissions determine app access for non-privileged profiles', () => {
  assert.equal(appAccessLevel({ workProfile: 'admin' }, 'inventory'), 2);
  assert.equal(appAccessLevel({ workProfile: 'client', modulePermissions: [{ module: 'leads', access: 'view' }] }, 'leads'), 1);
  assert.equal(appAccessLevel({ workProfile: 'employee', modulePermissions: [{ module: 'inventory', access: 'view' }] }, 'inventory'), 1);
  assert.equal(appAccessLevel({ workProfile: 'employee', modulePermissions: [{ module: 'hr', access: 'manage' }] }, 'hr'), 2);
});

test('HR module management applies regardless of account profile', async () => {
  const employeeRequest = { method: 'GET', user: { workProfile: 'employee', modulePermissions: [{ module: 'hr', access: 'manage' }] } };
  await authorizeHrModule('expenses', 'manage')(employeeRequest, {}, (error) => assert.equal(error, undefined));
  assert.equal(employeeRequest.hrAccess, 'manage');

  const clientRequest = { method: 'GET', user: { workProfile: 'client', modulePermissions: [{ module: 'hr', access: 'manage' }] } };
  await authorizeHrModule('payroll', 'manage')(clientRequest, {}, (error) => assert.equal(error, undefined));
  assert.equal(clientRequest.hrAccess, 'manage');
});

test('explicit HR permission grants app and payroll management access', async () => {
  const user = { workProfile: 'employee', modulePermissions: [{ module: 'hr', access: 'manage' }] };
  assert.equal(appAccessLevel(user, 'hr'), 2);

  let appError;
  authorizeAppModule('hr')({ user }, {}, (error) => { appError = error; });
  assert.equal(appError, undefined);

  const request = { method: 'GET', user };
  await authorizeHrModule('payroll', 'manage')(request, {}, (error) => assert.equal(error, undefined));
  assert.equal(request.hrAccess, 'manage');
});

test('application access defaults to deny and distinguishes view from manage', () => {
  let denied;
  authorizeAppModule('tasks')({ user: { role: 'sales' } }, {}, (error) => { denied = error; });
  assert.equal(denied.statusCode, 403);

  let viewed;
  authorizeAppModule('tasks')({ user: { role: 'sales', modulePermissions: [{ module: 'tasks', access: 'view' }] } }, {}, (error) => { viewed = error; });
  assert.equal(viewed, undefined);

  let mutationDenied;
  authorizeAppModule('tasks', 'manage')({ user: { role: 'sales', modulePermissions: [{ module: 'tasks', access: 'view' }] } }, {}, (error) => { mutationDenied = error; });
  assert.equal(mutationDenied.statusCode, 403);
});

test('notifications require an explicit module permission', () => {
  let denied;
  authorizeAppModule('notifications')({ user: { role: 'sales' } }, {}, (error) => { denied = error; });
  assert.equal(denied.statusCode, 403);

  let allowed;
  authorizeAppModule('notifications')({ user: { role: 'sales', modulePermissions: [{ module: 'notifications', access: 'view' }] } }, {}, (error) => { allowed = error; });
  assert.equal(allowed, undefined);
});

test('employee profiles require assigned HR access', () => {
  let denied;
  const user = { workProfile: 'employee', modulePermissions: [{ module: 'hr', access: 'none' }] };
  authorizeAppModule('hr')({ method: 'GET', user }, {}, (error) => { denied = error; });
  assert.equal(denied.statusCode, 403);
  assert.equal(appAccessLevel(user, 'hr'), 0);
});

test('director HR access follows the assigned module permission', async () => {
  let error;
  const user = { workProfile: 'director', modulePermissions: [{ module: 'hr', access: 'manage' }] };
  authorizeAppModule('hr')({ user }, {}, (nextError) => { error = nextError; });
  assert.equal(error, undefined);

  const request = { method: 'GET', user };
  await authorizeHrModule('payroll', 'manage')(request, {}, (nextError) => { error = nextError; });
  assert.equal(error, undefined);
  assert.equal(request.hrAccess, 'manage');
});

test('production setup requires a one-time setup token', async () => {
  const originalProduction = env.isProduction;
  const originalSetupToken = env.setupToken;
  User.exists = async () => null;
  env.isProduction = true;
  env.setupToken = 'setup-token-123456789012';

  try {
    let denied;
    await allowFirstSuperadminOrUserManager(
      { body: { role: 'superadmin' }, get: () => 'wrong-token' },
      {},
      (error) => {
        denied = error;
      },
    );

    assert.equal(denied.statusCode, 403);

    let allowed;
    await allowFirstSuperadminOrUserManager(
      { body: { role: 'superadmin' }, get: () => 'setup-token-123456789012' },
      {},
      (error) => {
        allowed = error || true;
      },
    );

    assert.equal(allowed, true);
  } finally {
    env.isProduction = originalProduction;
    env.setupToken = originalSetupToken;
  }
});

test('setup explains when the first user already exists', async () => {
  User.exists = async () => ({ _id: 'existing-user' });

  let denied;
  await allowFirstSuperadminOrUserManager(
    { body: { role: 'superadmin' }, get: () => '' },
    {},
    (error) => {
      denied = error;
    },
  );

  assert.equal(denied.statusCode, 409);
  assert.match(denied.message, /setup is already complete/i);
});

test('login updates lastLoginAt without revalidating legacy user fields', async () => {
  const passwordHash = await hashPassword('CodexAdmin123!');
  const user = {
    _id: 'user-1',
    id: 'user-1',
    email: 'codex.superadmin@example.com',
    role: 'superadmin',
    status: 'active',
    passwordHash,
  };
  let lastLoginUpdate;
  let loginHistory;

  User.findOne = (filter) => {
    assert.deepEqual(filter, { email: 'codex.superadmin@example.com' });
    return {
      select(field) {
        assert.equal(field, '+passwordHash');
        return Promise.resolve(user);
      },
    };
  };
  User.updateOne = async (filter, update) => {
    assert.deepEqual(filter, { _id: 'user-1' });
    lastLoginUpdate = update.$set.lastLoginAt;
  };
  AuthSession.find = () => ({
    select() {
      return this;
    },
    lean() {
      return Promise.resolve([]);
    },
  });
  AuthSession.updateMany = async () => ({ modifiedCount: 0 });
  AuthSession.create = async () => ({});
  LoginHistory.updateMany = async () => ({ modifiedCount: 0 });
  LoginHistory.create = async (body) => {
    loginHistory = body;
    return body;
  };

  const response = {
    statusCode: 200,
    cookies: {},
    cookie(name, value) {
      this.cookies[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };

  await login(
    {
      body: { email: 'codex.superadmin@example.com', password: 'CodexAdmin123!' },
      ...testReq(),
    },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.user, user);
  assert.ok(lastLoginUpdate instanceof Date);
  assert.equal(loginHistory.user, 'user-1');
  assert.equal(loginHistory.email, 'codex.superadmin@example.com');
  assert.equal(loginHistory.role, 'superadmin');
  assert.equal(loginHistory.ipAddress, '127.0.0.1');
  assert.equal(loginHistory.userAgent, 'node-test');
  assert.equal(loginHistory.loggedInAt, lastLoginUpdate);
  assert.ok(response.cookies.sales_crm_refresh);
});

test('login revokes an existing active session instead of blocking the user', async () => {
  const passwordHash = await hashPassword('CodexAdmin123!');
  const user = {
    _id: 'user-1',
    id: 'user-1',
    email: 'codex.sales@example.com',
    role: 'sales',
    status: 'active',
    passwordHash,
  };

  User.findOne = () => ({ select: () => Promise.resolve(user) });
  User.updateOne = async () => {};
  AuthSession.find = () => ({
    select() {
      return this;
    },
    lean() {
      return Promise.resolve([{ accessTokenJti: 'access-1' }]);
    },
  });
  let revokedFilter;
  AuthSession.updateMany = async (filter) => {
    revokedFilter = filter;
  };
  AuthSession.create = async () => ({});
  BlockedToken.updateOne = async () => {};
  LoginHistory.updateMany = async () => ({ modifiedCount: 1 });
  LoginHistory.create = async () => ({});

  const response = {
    statusCode: 200,
    cookies: {},
    cookie(name, value) {
      this.cookies[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };

  await login(
    {
      body: { email: 'codex.sales@example.com', password: 'CodexAdmin123!' },
      ...testReq(),
    },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.deepEqual(revokedFilter, { user: 'user-1', revokedAt: null });
  assert.ok(response.cookies.sales_crm_refresh);
});

test('third failed login creates a temporary lock without suspending the account', async () => {
  const user = {
    _id: 'user-1',
    email: 'codex.sales@example.com',
    status: 'active',
    passwordHash: await hashPassword('Correct123!'),
  };
  let userUpdate;

  User.findOne = () => ({ select: () => Promise.resolve(user) });
  let attempts = 2;
  setLoginAttemptStoreForTest({
    increment: async () => ++attempts,
    delete: async () => { attempts = 0; },
  });
  User.updateOne = async (_filter, update) => { userUpdate = update; };

  const response = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  await login({ body: { email: user.email, password: 'wrong-password' }, ...testReq() }, response);

  assert.equal(response.statusCode, 429);
  assert.equal(userUpdate.$set.status, undefined);
  assert.ok(userUpdate.$set.loginLockedAt instanceof Date);
  assert.ok(userUpdate.$set.loginLockedAt > new Date());
});

test('failed login tells an active user how many attempts remain', async () => {
  const user = { _id: 'user-1', email: 'codex.sales@example.com', status: 'active', passwordHash: await hashPassword('Correct123!') };
  User.findOne = () => ({ select: () => Promise.resolve(user) });
  User.updateOne = async () => {};
  setLoginAttemptStoreForTest({ increment: async () => 1, delete: async () => {} });
  const response = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };

  await login({ body: { email: user.email, password: 'wrong-password' }, ...testReq() }, response);

  assert.equal(response.statusCode, 401);
  assert.match(response.body.error.message, /2 attempts remaining/);
});

test('locked login tells the user how long to wait', async () => {
  const user = { _id: 'user-1', email: 'codex.sales@example.com', status: 'active', loginLockedAt: new Date(Date.now() + 59 * 60_000), passwordHash: await hashPassword('Correct123!') };
  User.findOne = () => ({ select: () => Promise.resolve(user) });
  const response = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };

  await login({ body: { email: user.email, password: 'wrong-password' }, ...testReq() }, response);

  assert.equal(response.statusCode, 429);
  assert.match(response.body.error.message, /59 minute/);
});

test('logout closes the current login history row', async () => {
  const token = createAccessToken({ id: 'user-1', role: 'admin' });
  let logoutUpdate;

  LoginHistory.findOneAndUpdate = async (filter, update, options) => {
    assert.deepEqual(filter, { user: 'user-1', logoutAt: null });
    assert.deepEqual(options, { sort: { loggedInAt: -1 } });
    logoutUpdate = update.$set;
  };
  AuthSession.findOneAndUpdate = async () => null;
  BlockedToken.updateOne = async () => {};

  const response = {
    cookies: {},
    clearCookie(name) {
      this.cookies[name] = '';
    },
    json(body) {
      this.body = body;
      return this;
    },
  };

  await logout(
    {
      body: {},
      headers: {},
      get: (name) => (name === 'authorization' ? `Bearer ${token}` : name === 'user-agent' ? 'node-test' : ''),
    },
    response,
  );

  assert.ok(logoutUpdate.logoutAt instanceof Date);
  assert.equal(logoutUpdate.logoutReason, 'logout');
  assert.equal(response.body.data.ok, true);
});

test('access token contains user id and role', () => {
  const token = createAccessToken({ id: 'user-1', role: 'superadmin' });
  const claims = verifyAccessToken(token);

  assert.equal(claims.sub, 'user-1');
  assert.equal(claims.role, 'superadmin');
  assert.equal(claims.type, 'access');
  assert.ok(claims.jti);
  assert.ok(claims.exp > claims.iat);
});

test('access token verification rejects tampered tokens', () => {
  const token = createAccessToken({ id: 'user-1', role: 'superadmin' });
  const [header, payload] = token.split('.');

  assert.equal(verifyAccessToken(`${header}.${payload}.bad-signature`), null);
});

test('refresh rotation revokes old session and blocks old access token id', async () => {
  const user = { _id: 'user-1', id: 'user-1', role: 'admin', status: 'active' };
  const oldAccess = createAccessTokenPair(user);
  let createdSession;
  let blockedJti;
  let atomicFilter;
  let atomicUpdate;
  const session = {
    user,
    accessTokenJti: oldAccess.accessTokenJti,
    expiresAt: new Date(Date.now() + 1000),
    revokedAt: null,
  };

  AuthSession.findOneAndUpdate = (filter, update) => {
    atomicFilter = filter;
    atomicUpdate = update;
    session.revokedAt = update.revokedAt;
    session.replacedBy = update.replacedBy;
    return { populate: async () => session };
  };
  AuthSession.create = async (body) => {
    createdSession = body;
    return body;
  };
  BlockedToken.updateOne = async (filter) => {
    blockedJti = filter.jti;
  };

  const rotated = await rotateSession('refresh-token', testReq('test-agent'));

  assert.ok(rotated.accessToken);
  assert.ok(rotated.refreshToken);
  assert.equal(atomicFilter.tokenHash, hashRefreshToken('refresh-token'));
  assert.equal(atomicFilter.revokedAt, null);
  assert.ok(atomicFilter.expiresAt.$gt instanceof Date);
  assert.equal(session.revokedAt instanceof Date, true);
  assert.equal(session.replacedBy, atomicUpdate.replacedBy);
  assert.equal(blockedJti, oldAccess.accessTokenJti);
  assert.equal(createdSession.user, 'user-1');
});

test('createSession creates one session without revoking existing sessions', async () => {
  const user = { _id: 'user-1', id: 'user-1', role: 'sales', status: 'active' };
  let createdSession;

  AuthSession.updateMany = async () => {
    throw new Error('createSession should not revoke sessions');
  };
  AuthSession.create = async (body) => {
    createdSession = body;
    return body;
  };

  await createSession(user, testReq());

  assert.equal(createdSession.user, 'user-1');
});

test('refresh token reuse revokes active user sessions', async () => {
  const user = { _id: 'user-1', id: 'user-1', role: 'admin', status: 'active' };
  let revokeFilter;
  const session = {
    user,
    expiresAt: new Date(Date.now() + 1000),
    revokedAt: new Date(),
  };

  AuthSession.findOneAndUpdate = () => ({ populate: async () => null });
  AuthSession.findOne = () => ({ populate: async () => session });
  AuthSession.find = () => ({ select() { return this; }, lean() { return Promise.resolve([]); } });
  AuthSession.updateMany = async (filter) => {
    revokeFilter = filter;
  };

  assert.equal(await rotateSession('used-refresh-token', testReq('')), null);
  assert.deepEqual(revokeFilter, { user: 'user-1', revokedAt: null });
});

test('blocked access token ids are rejected by lookup', async () => {
  BlockedToken.exists = async () => ({ _id: 'blocked-1' });

  assert.equal(await isAccessTokenBlocked({ jti: 'token-1' }), true);
});

test('rate limiter blocks after the configured attempt count', async () => {
  const hit = {
    count: 3,
    windowExpiresAt: new Date(Date.now() + 60_000),
  };
  let update;
  RateLimit.findOneAndUpdate = async (filter, body, options) => {
    update = body;
    assert.equal(filter.key, 'login:127.0.0.1:admin@example.com');
    assert.equal(options.updatePipeline, true);
    return hit;
  };

  const req = { ip: '127.0.0.1', body: { email: 'admin@example.com' } };
  const res = {
    statusCode: 200,
    headers: {},
    set(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };

  await rateLimit({ scope: 'login', limit: 2, windowMs: 60_000 })(req, res, () => {
    throw new Error('next should not run');
  });

  assert.ok(Array.isArray(update));
  assert.equal(res.statusCode, 429);
  assert.equal(res.body.error.message, 'Too many attempts. Try again later.');
});

test('failed-login tracking uses the database fallback', async () => {
  let deletedKey;
  setLoginAttemptStoreForTest(undefined);
  RateLimit.findOneAndUpdate = async (filter, _update, options) => {
    assert.equal(filter.key, 'auth:failed-login:user-1');
    assert.equal(options.updatePipeline, true);
    return { count: 2 };
  };
  RateLimit.deleteOne = async (filter) => { deletedKey = filter.key; };

  assert.equal(await recordFailedLoginAttempt('user-1'), 2);
  await clearFailedLoginAttempts('user-1');
  assert.equal(deletedKey, 'auth:failed-login:user-1');
});
