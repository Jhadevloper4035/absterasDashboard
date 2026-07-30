import assert from 'node:assert/strict';
import { test } from 'node:test';
import { uploadRouter } from '../src/routes/upload.routes.js';

test('upload router does not expose direct presigned uploads', () => {
  const routes = uploadRouter.stack.map((layer) => layer.route?.path).filter(Boolean);

  assert.deepEqual(routes, ['/multipart']);
});
