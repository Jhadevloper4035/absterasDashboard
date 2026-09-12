import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DRAWING_STATUSES, Drawing } from '../src/modules/designer/models/drawing.model.js';
import { reviewStatus } from '../src/modules/designer/drawing.controller.js';

test('Drawing keeps a versioned PDF and approval workflow history', async () => {
  const drawing = new Drawing({ client: '507f1f77bcf86cd799439011', clientSite: '507f1f77bcf86cd799439012', title: 'Tower A elevation drawing', createdBy: '507f1f77bcf86cd799439013', versions: [{ number: 1, attachment: { key: 'uploads/document/drawing.pdf' }, uploadedBy: '507f1f77bcf86cd799439013' }], history: [{ action: 'APPROVED', attachment: { key: 'uploads/document/approval.pdf' }, performedBy: '507f1f77bcf86cd799439014' }] });
  await drawing.validate();
  assert.equal(drawing.status, 'PENDING_REVIEW');
  assert.ok(DRAWING_STATUSES.includes(drawing.status));
  assert.equal(drawing.versions[0].number, 1);
  assert.equal(drawing.history[0].attachment.key, 'uploads/document/approval.pdf');
  assert.equal(reviewStatus('request_revision'), 'REVISION_REQUESTED');
});
