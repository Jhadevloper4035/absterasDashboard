import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { listUnreadNotifications } from '../src/controllers/notification.controller.js';
import { Lead } from '../src/models/lead.model.js';
import { Notification } from '../src/models/notification.model.js';
import { Task } from '../src/models/task.model.js';

const originalNotificationFind = Notification.find;
const originalLeadFind = Lead.find;
const originalTaskFind = Task.find;

function res() {
  return {
    body: undefined,
    json(body) {
      this.body = body;
      return this;
    },
  };
}

afterEach(() => {
  Notification.find = originalNotificationFind;
  Lead.find = originalLeadFind;
  Task.find = originalTaskFind;
});

test('old task-note notifications infer sender from the task note author', async () => {
  const noteTime = new Date('2026-07-31T18:15:45.000Z');
  let taskQuery;

  Notification.find = () => ({
    sort() {
      return this;
    },
    limit() {
      return this;
    },
    lean() {
      return Promise.resolve([
        {
          _id: 'notification-1',
          createdAt: noteTime.toISOString(),
          metadata: { type: 'task.note', taskId: 'task-1' },
        },
      ]);
    },
  });
  Task.find = (query) => {
    taskQuery = query;
    return {
      populate() {
        return this;
      },
      lean() {
        return Promise.resolve([
          {
            _id: 'task-1',
            createdBy: { name: 'Kavita Patel', role: 'manager' },
            notes: [{ createdAt: noteTime.toISOString(), createdBy: { name: 'Rohan Mehta', role: 'admin' } }],
          },
        ]);
      },
    };
  };

  const response = res();
  await listUnreadNotifications({ user: { _id: 'user-1' } }, response);

  assert.deepEqual(taskQuery, { _id: { $in: ['task-1'] } });
  assert.equal(response.body.data[0].metadata.fromName, 'Rohan Mehta');
  assert.equal(response.body.data[0].metadata.fromRole, 'admin');
});

test('old lead-assignment notifications infer sender from assignment history', async () => {
  const assignedAt = new Date('2026-08-01T10:30:00.000Z');
  let leadQuery;

  Notification.find = () => ({
    sort() {
      return this;
    },
    limit() {
      return this;
    },
    lean() {
      return Promise.resolve([
        {
          _id: 'notification-2',
          createdAt: assignedAt.toISOString(),
          metadata: { type: 'lead.assigned', leadId: 'lead-1' },
        },
      ]);
    },
  });
  Task.find = () => {
    throw new Error('tasks should not be queried for lead notifications');
  };
  Lead.find = (query) => {
    leadQuery = query;
    return {
      populate() {
        return this;
      },
      lean() {
        return Promise.resolve([
          {
            _id: 'lead-1',
            assignmentHistory: [{ assignedAt: assignedAt.toISOString(), actor: { name: 'Admin User', role: 'admin' } }],
          },
        ]);
      },
    };
  };

  const response = res();
  await listUnreadNotifications({ user: { _id: 'user-1' } }, response);

  assert.deepEqual(leadQuery, { _id: { $in: ['lead-1'] } });
  assert.equal(response.body.data[0].metadata.fromName, 'Admin User');
  assert.equal(response.body.data[0].metadata.fromRole, 'admin');
});
