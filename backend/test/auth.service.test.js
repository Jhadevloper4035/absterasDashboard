import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hashPassword, verifyPassword } from '../src/services/password.service.js';
import { createAccessToken, verifyAccessToken } from '../src/services/token.service.js';

test('password hashing verifies only the original password', async () => {
  const hash = await hashPassword('secret-password');

  assert.equal(await verifyPassword('secret-password', hash), true);
  assert.equal(await verifyPassword('wrong-password', hash), false);
});

test('access token contains user id and role', () => {
  const token = createAccessToken({ id: 'user-1', role: 'superadmin' });
  const claims = verifyAccessToken(token);

  assert.equal(claims.sub, 'user-1');
  assert.equal(claims.role, 'superadmin');
});
