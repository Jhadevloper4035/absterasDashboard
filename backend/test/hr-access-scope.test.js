import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { listAttendance } from '../src/modules/hr/controllers/attendance.controller.js';
import { listEmployees } from '../src/modules/hr/controllers/employee.controller.js';
import { authorizeHrModule } from '../src/modules/auth/middleware/auth.middleware.js';
import { Attendance } from '../src/modules/hr/models/attendance.model.js';
import { Employee } from '../src/modules/hr/models/employee.model.js';
import { User } from '../src/models/user.model.js';

const originals = { attendanceFind: Attendance.find, attendanceCount: Attendance.countDocuments, employeeFind: Employee.find, employeeCount: Employee.countDocuments, userFind: User.find };
const response = () => ({ json(body) { this.body = body; } });
const listQuery = (records = []) => ({ populate() { return this; }, sort() { return this; }, skip() { return this; }, limit: async () => records });

afterEach(() => {
  Attendance.find = originals.attendanceFind;
  Attendance.countDocuments = originals.attendanceCount;
  Employee.find = originals.employeeFind;
  Employee.countDocuments = originals.employeeCount;
  User.find = originals.userFind;
});

test('view-only employee listing ignores search and department filters', async () => {
  let filter;
  Employee.find = (query) => { filter = query; return listQuery(); };
  Employee.countDocuments = async () => 0;
  User.find = () => { throw new Error('view-only listing must not search all users'); };

  await listEmployees({ user: { _id: 'self', role: 'salesperson' }, hrAccess: 'view', query: { q: 'Ava', department: 'other' } }, response());

  assert.deepEqual(filter, { user: 'self' });
});

test('managed employee listing includes only users with Employee access', async () => {
  let filter;
  User.find = (query) => {
    assert.deepEqual(query, { accessTypes: 'employee' });
    return { select: async () => [{ _id: 'employee-user' }] };
  };
  Employee.find = (query) => { filter = query; return listQuery(); };
  Employee.countDocuments = async () => 0;

  await listEmployees({ user: { role: 'admin' }, query: {} }, response());

  assert.deepEqual(filter, { user: { $in: ['employee-user'] } });
});

test('view-only attendance listing ignores department filters', async () => {
  let filter;
  Employee.find = (query) => {
    assert.deepEqual(query, { user: 'self' });
    return { select: async () => [{ _id: 'employee-self' }] };
  };
  Attendance.find = (query) => { filter = query; return listQuery(); };
  Attendance.countDocuments = async () => 0;

  await listAttendance({ user: { _id: 'self' }, hrAccess: 'view', query: { department: 'other' } }, response());

  assert.deepEqual(filter, { employee: { $in: ['employee-self'] } });
});

test('managed attendance listing filters the selected employee', async () => {
  let filter;
  Attendance.find = (query) => { filter = query; return listQuery(); };
  Attendance.countDocuments = async () => 0;

  await listAttendance({ user: { _id: 'manager' }, hrAccess: 'manage', query: { employee: '67a1613416af3470a8e81720' } }, response());

  assert.deepEqual(filter, { employee: '67a1613416af3470a8e81720' });
});

test('employee overview access is limited to the employee role', async () => {
  const req = { user: { accessTypes: ['employee'] } };
  await authorizeHrModule('employee-overview', 'view')(req, {}, (error) => assert.equal(error, undefined));
  assert.equal(req.hrAccess, 'view');
});
