import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { decideAttendanceCorrection, requestAttendanceCorrection } from '../src/modules/hr/controllers/attendance.controller.js';
import { Attendance } from '../src/modules/hr/models/attendance.model.js';
import { Employee } from '../src/modules/hr/models/employee.model.js';
import { Holiday } from '../src/modules/hr/models/holiday.model.js';

const originalFindById = Attendance.findById;
const originalEmployeeExists = Employee.exists;
const originalEmployeeFindById = Employee.findById;
const originalEmployeeFindOne = Employee.findOne;
const originalAttendanceFindOne = Attendance.findOne;
const originalAttendanceCreate = Attendance.create;
const originalHolidayExists = Holiday.exists;
const response = () => ({ statusCode: 200, body: undefined, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });

afterEach(() => {
  Attendance.findById = originalFindById;
  Employee.exists = originalEmployeeExists;
  Employee.findById = originalEmployeeFindById;
  Employee.findOne = originalEmployeeFindOne;
  Attendance.findOne = originalAttendanceFindOne;
  Attendance.create = originalAttendanceCreate;
  Holiday.exists = originalHolidayExists;
});

test('employees can request a correction for a missing working-day record', async () => {
  const date = new Date();
  do date.setUTCDate(date.getUTCDate() - 1); while (date.getUTCDay() === 0);
  const day = date.toISOString().slice(0, 10);
  let created;
  Employee.findOne = () => ({ select: async () => ({ _id: 'employee-1' }) });
  Attendance.findOne = async () => null;
  Attendance.create = async (document) => { created = { _id: 'attendance-1', ...document }; return created; };
  Holiday.exists = async () => false;
  const result = response();

  await requestAttendanceCorrection({ params: {}, user: { _id: 'user-1' }, body: { date: day, requestedStatus: 'present', requestedCheckIn: '09:00', requestedCheckOut: '18:00', reason: 'Attendance was not marked.' } }, result);

  assert.equal(result.statusCode, 201);
  assert.equal(created.status, 'absent');
  assert.equal(created.correctionRequest.status, 'pending');
});

test('HR approval applies the requested attendance correction', async () => {
  const attendance = { _id: 'attendance-1', employee: 'employee-1', status: 'absent', correctionRequest: { status: 'pending', reason: 'I was present.', requestedStatus: 'present', requestedCheckIn: '09:00', requestedCheckOut: '18:00' }, save: async () => {} };
  Attendance.findById = async () => attendance;
  Employee.findById = () => ({ select: async () => ({ employeeType: 'office' }) });
  const result = response();

  await decideAttendanceCorrection({ params: { id: 'attendance-1' }, user: { _id: 'hr-1' }, body: { status: 'approved' } }, result);

  assert.equal(result.statusCode, 200);
  assert.equal(attendance.correctionRequest.status, 'approved');
  assert.equal(attendance.checkIn, '09:00');
  assert.equal(attendance.checkOut, '18:00');
  assert.equal(attendance.isRegularized, true);
});

test('employees can request one pending correction for their own attendance only', async () => {
  let saved = false;
  const attendance = { _id: 'attendance-1', employee: 'employee-1', correctionRequest: undefined, save: async () => { saved = true; } };
  Attendance.findById = async () => attendance;
  Employee.exists = async (query) => query._id === 'employee-1' && query.user === 'user-1';
  const request = { params: { id: 'attendance-1' }, user: { _id: 'user-1' }, body: { requestedStatus: 'present', requestedCheckIn: '09:30', requestedCheckOut: '18:30', reason: 'My punch was not recorded.' } };
  const first = response();

  await requestAttendanceCorrection(request, first);

  assert.equal(first.statusCode, 201);
  assert.equal(saved, true);
  assert.equal(attendance.correctionRequest.status, 'pending');
  const second = response();
  await requestAttendanceCorrection(request, second);
  assert.equal(second.statusCode, 409);
});
