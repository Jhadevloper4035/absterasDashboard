import assert from 'node:assert/strict';
import { test } from 'node:test';
import mongoose from 'mongoose';
import { USER_ROLES, USER_STATUSES, WORK_PROFILES, User } from '../src/models/user.model.js';

test('user defaults to a role-neutral account', () => {
  const user = new User({
    name: 'Asha',
    email: 'asha@example.com',
    phone: '9876543210',
    passwordHash: 'scrypt:salt:hash',
  });

  assert.equal(user.role, 'user');
  assert.equal(user.status, 'active');
  assert.equal(user.timezone, 'UTC');
  assert.equal(user.notificationPreferences.inApp, true);
  assert.equal(user.notificationPreferences.morningSummary.time, '08:00');
});

test('user role is limited to current roles', async () => {
  assert.deepEqual(USER_ROLES, ['superadmin', 'admin', 'user', 'sales', 'operations', 'accounts', 'designers']);
  assert.deepEqual(USER_STATUSES, ['active', 'inactive', 'invited', 'suspended']);
  assert.deepEqual(WORK_PROFILES, ['superadmin', 'admin', 'client', 'director', 'employee']);
  await assert.rejects(
    () => new User({
      name: 'Asha',
      email: 'asha@example.com',
      phone: '9876543210',
      passwordHash: 'scrypt:salt:hash',
      role: 'manager',
    }).validate(),
    /`manager` is not a valid enum value/,
  );
});

test('user requires a valid timezone and morning summary time', async () => {
  await new User({
    name: 'Asha',
    email: 'asha@example.com',
    phone: '9876543210',
    passwordHash: 'scrypt:salt:hash',
    timezone: 'Asia/Kolkata',
    notificationPreferences: { morningSummary: { time: '08:30' } },
  }).validate();

  await assert.rejects(
    () => new User({
      name: 'Asha',
      email: 'asha@example.com',
      phone: '9876543210',
      passwordHash: 'scrypt:salt:hash',
      timezone: 'Mars/Base',
    }).validate(),
    /Invalid timezone/,
  );

  await assert.rejects(
    () => new User({
      name: 'Asha',
      email: 'asha@example.com',
      phone: '9876543210',
      passwordHash: 'scrypt:salt:hash',
      notificationPreferences: { morningSummary: { time: '25:00' } },
    }).validate(),
    /Path `notificationPreferences.morningSummary.time` is invalid/,
  );
});

test('user json never includes password hash', () => {
  const user = new User({
    name: 'Asha',
    email: 'asha@example.com',
    phone: '9876543210',
    passwordHash: 'scrypt:salt:hash',
  });

  assert.equal(user.toJSON().passwordHash, undefined);
});

test('user json never includes a pending password reset hash', () => {
  const user = new User({
    name: 'Asha',
    email: 'asha@example.com',
    phone: '9876543210',
    passwordHash: 'scrypt:salt:hash',
    passwordResetPasswordHash: 'scrypt:reset:hash',
  });

  assert.equal(user.toJSON().passwordResetPasswordHash, undefined);
});

test.after(async () => {
  await mongoose.disconnect();
});
