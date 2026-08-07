import assert from 'node:assert/strict';
import { test } from 'node:test';
import mongoose from 'mongoose';
import { Employee } from '../src/models/employee.model.js';

test('employee requires the core HR profile fields', async () => {
  await assert.rejects(() => new Employee({}).validate(), /Path `user` is required/);
});

test('employee accepts a complete profile and document metadata', async () => {
  const employee = new Employee({
    user: new mongoose.Types.ObjectId(),
    employeeType: 'site',
    department: new mongoose.Types.ObjectId(),
    designation: new mongoose.Types.ObjectId(),
    joiningDate: new Date('2026-01-01'),
    documents: [{ type: 'ID proof', key: 'uploads/document/id.pdf', expiresAt: new Date('2027-01-01') }],
  });
  await employee.validate();
  assert.equal(employee.status, 'active');
  assert.equal(employee.documents[0].type, 'ID proof');
  assert.equal(employee.documents[0].expiresAt.toISOString().slice(0, 10), '2027-01-01');
});

test('employee accepts a profile photo attachment', async () => {
  const employee = new Employee({ user: new mongoose.Types.ObjectId(), employeeType: 'office', department: new mongoose.Types.ObjectId(), designation: new mongoose.Types.ObjectId(), joiningDate: new Date('2026-01-01'), photo: { type: 'Employee photo', key: 'uploads/image/photo.jpg', contentType: 'image/jpeg' } });
  await employee.validate();
  assert.equal(employee.photo.contentType, 'image/jpeg');
});
