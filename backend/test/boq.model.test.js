import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BOQ_STATUSES, Boq } from '../src/modules/designer/models/boq.model.js';
import { reviewStatus } from '../src/modules/designer/designer.controller.js';

test('BOQ keeps its title, versioned PDF submission, and valid workflow status', async () => {
  const boq = new Boq({ client: '507f1f77bcf86cd799439011', clientSite: '507f1f77bcf86cd799439012', title: 'Tower A wardrobe BOQ', description: 'Initial quantity schedule', createdBy: '507f1f77bcf86cd799439013', versions: [{ number: 1, attachment: { key: 'uploads/document/boq.pdf' }, uploadedBy: '507f1f77bcf86cd799439013' }], history: [{ action: 'APPROVED', attachment: { key: 'uploads/document/approval.pdf' }, performedBy: '507f1f77bcf86cd799439014' }] });
  await boq.validate();
  assert.equal(boq.title, 'Tower A wardrobe BOQ');
  assert.equal(boq.status, 'PENDING_REVIEW');
  assert.ok(BOQ_STATUSES.includes(boq.status));
  assert.equal(boq.versions[0].number, 1);
  assert.equal(boq.history[0].attachment.key, 'uploads/document/approval.pdf');
});

test('BOQ review actions follow the approval cycle', () => {
  assert.equal(reviewStatus('approve'), 'APPROVED');
  assert.equal(reviewStatus('request_revision'), 'REVISION_REQUESTED');
  assert.equal(reviewStatus('reject'), 'REJECTED');
  assert.equal(reviewStatus('resubmit'), undefined);
});
