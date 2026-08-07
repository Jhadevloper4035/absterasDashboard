import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculateAttendance } from '../src/modules/hr/services/attendance.service.js';

test('attendance flags late, half-day, work hours, and short leave', () => {
  assert.deepEqual(calculateAttendance({ employeeType: 'site', status: 'present', checkIn: '10:40', checkOut: '18:45' }), { status: 'late', workMinutes: 485, isShortLeave: false, overtimeMinutes: 45 });
  assert.deepEqual(calculateAttendance({ employeeType: 'office', status: 'present', checkIn: '16:10', checkOut: '19:00' }), { status: 'half-day', workMinutes: 170, isShortLeave: true, overtimeMinutes: 0 });
  assert.deepEqual(calculateAttendance({ employeeType: 'office', status: 'present', checkIn: '11:00', checkOut: '18:00' }), { status: 'late', workMinutes: 420, isShortLeave: true, overtimeMinutes: 0 });
});
