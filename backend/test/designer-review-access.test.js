import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hasDesignerReviewAccess } from '../src/modules/auth/middleware/auth.middleware.js';
import { canViewAllProductionData } from '../src/modules/designer/production-data.controller.js';

test('Only a director with explicit Designer access can review designer documents', () => {
  assert.equal(hasDesignerReviewAccess({ workProfile: 'director', modulePermissions: [{ module: 'designer', access: 'view' }] }), true);
  assert.equal(hasDesignerReviewAccess({ workProfile: 'director', modulePermissions: [{ module: 'designer', access: 'none' }] }), false);
  assert.equal(hasDesignerReviewAccess({ role: 'admin', modulePermissions: [{ module: 'designer', access: 'manage' }] }), false);
});

test('Directors with Designer access can view all production data', () => {
  assert.equal(canViewAllProductionData({ workProfile: 'director', modulePermissions: [{ module: 'designer', access: 'view' }] }), true);
  assert.equal(canViewAllProductionData({ workProfile: 'director', modulePermissions: [{ module: 'designer', access: 'none' }] }), false);
});
