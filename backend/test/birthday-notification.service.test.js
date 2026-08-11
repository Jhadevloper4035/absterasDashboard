import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isBirthdayToday } from '../src/modules/hr/services/birthday-notification.service.js';

test('birthday matching uses the employee timezone', () => {
  const now = new Date('2026-08-10T00:30:00.000Z');
  assert.equal(isBirthdayToday('1990-08-10', now, 'UTC'), true);
  assert.equal(isBirthdayToday('1990-08-10', now, 'America/Los_Angeles'), false);
});
