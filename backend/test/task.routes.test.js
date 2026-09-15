import assert from 'node:assert/strict';
import { test } from 'node:test';
import { taskRouter } from '../src/modules/tasks/tasks.routes.js';

test('task uploads use the Task Management route', () => {
  const routes = taskRouter.stack.map((layer) => layer.route?.path).filter(Boolean);

  assert.ok(routes.includes('/uploads'));
});
