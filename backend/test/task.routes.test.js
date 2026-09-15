import assert from 'node:assert/strict';
import { test } from 'node:test';
import { taskRouter } from '../src/modules/tasks/tasks.routes.js';

test('task uploads use Task Management routes', () => {
  const routes = taskRouter.stack.map((layer) => layer.route?.path).filter(Boolean);

  assert.equal(routes.filter((path) => path === '/uploads').length, 2);
});
