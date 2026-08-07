import assert from 'node:assert/strict';
import { test } from 'node:test';
import { leaveAttendanceDates, leaveDays } from '../src/services/leave.service.js';

test('leave days exclude configured holidays without assuming weekend policy', () => {
  assert.equal(leaveDays('2026-08-03', '2026-08-05', [new Date('2026-08-04T00:00:00.000Z')]), 2);
  assert.equal(leaveDays('2026-08-05', '2026-08-03'), 0);
});

test('approved leave produces one attendance date per non-holiday leave day', () => {
  assert.deepEqual(leaveAttendanceDates('2026-08-03', '2026-08-05', [new Date('2026-08-04T00:00:00.000Z')]).map((date) => date.toISOString().slice(0, 10)), ['2026-08-03', '2026-08-05']);
});

test('leave date helpers accept persisted Date values', () => {
  assert.equal(leaveDays(new Date('2026-08-03T12:00:00.000Z'), new Date('2026-08-04T12:00:00.000Z')), 2);
});
