import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hasDesignerReviewAccess } from '../src/modules/auth/middleware/auth.middleware.js';

test('Only a director with explicit Designer access can review designer documents', () => {
  assert.equal(hasDesignerReviewAccess({ workProfile: 'director', modulePermissions: [{ module: 'designer', access: 'view' }] }), true);
  assert.equal(hasDesignerReviewAccess({ workProfile: 'director', modulePermissions: [{ module: 'designer', access: 'none' }] }), false);
  assert.equal(hasDesignerReviewAccess({ role: 'admin', modulePermissions: [{ module: 'designer', access: 'manage' }] }), false);
});
