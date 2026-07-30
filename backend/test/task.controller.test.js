import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import mongoose from 'mongoose';
import { addTaskNote, createTask, listTaskAssignees, listTasks, updateTask } from '../src/controllers/task.controller.js';
import { Task } from '../src/models/task.model.js';
import { User } from '../src/models/user.model.js';
import { createAttachmentToken } from '../src/services/upload.service.js';

const originalTaskFind = Task.find;
const originalTaskFindOne = Task.findOne;
const originalUserFind = User.find;
const originalUserFindOne = User.findOne;

function res() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

afterEach(() => {
  Task.find = originalTaskFind;
  Task.findOne = originalTaskFindOne;
  User.find = originalUserFind;
  User.findOne = originalUserFindOne;
});

test('admin can create rich task for active non-superadmin user', async () => {
  const adminId = new mongoose.Types.ObjectId();
  const assigneeId = new mongoose.Types.ObjectId();
  let userQuery;
  let saved;
  const attachment = {
    key: 'uploads/document/test.pdf',
    checksum: 'abc123',
    url: 'https://evil.example/payload',
    originalName: 'spec.pdf',
  };
  attachment.attachmentToken = createAttachmentToken(attachment);
  User.findOne = async (filter) => {
    userQuery = filter;
    return { _id: assigneeId, role: 'admin', status: 'active' };
  };
  const originalSave = Task.prototype.save;
  const originalPopulate = Task.prototype.populate;
  Task.prototype.save = async function save() {
    saved = this;
  };
  Task.prototype.populate = async () => {};

  try {
    const response = res();
    await createTask(
      {
        user: { _id: adminId, role: 'admin' },
        body: {
          title: 'Implement JWT refresh-token rotation',
          description: 'Replace each refresh token after use',
          acceptanceCriteria: 'Old tokens cannot be reused',
          assignee: assigneeId,
          priority: 'High',
          status: 'To Do',
          labels: 'backend, authentication, security',
          attachments: [attachment],
          estimate: '5 points',
        },
      },
      response,
    );

    assert.equal(response.statusCode, 201);
    assert.deepEqual(userQuery, { _id: assigneeId, status: 'active', role: { $ne: 'superadmin' } });
    assert.equal(saved.title, 'Implement JWT refresh-token rotation');
    assert.deepEqual(saved.labels, ['backend', 'authentication', 'security']);
    assert.equal(saved.attachments[0].originalName, 'spec.pdf');
    assert.equal(saved.attachments[0].checksum, 'abc123');
    assert.equal(saved.attachments[0].url, undefined);
    assert.notEqual(response.body.data.attachments[0].url, 'https://evil.example/payload');
    assert.ok(response.body.data.attachments[0].attachmentToken);
  } finally {
    Task.prototype.save = originalSave;
    Task.prototype.populate = originalPopulate;
  }
});

test('task attachments require backend-issued upload token', async () => {
  const adminId = new mongoose.Types.ObjectId();
  const assigneeId = new mongoose.Types.ObjectId();
  let saved;
  User.findOne = async () => ({ _id: assigneeId, role: 'sales', status: 'active' });
  const originalSave = Task.prototype.save;
  const originalPopulate = Task.prototype.populate;
  Task.prototype.save = async function save() {
    saved = this;
  };
  Task.prototype.populate = async () => {};

  try {
    const response = res();
    await createTask(
      {
        user: { _id: adminId, role: 'admin' },
        body: {
          title: 'Fake attachment',
          assignee: assigneeId,
          attachments: [{ key: 'uploads/document/guessed.pdf', checksum: 'guess', attachmentToken: 'bad', url: 'https://evil.example' }],
        },
      },
      response,
    );

    assert.equal(response.statusCode, 201);
    assert.equal(saved.attachments.length, 0);
    assert.equal(response.body.data.attachments.length, 0);
  } finally {
    Task.prototype.save = originalSave;
    Task.prototype.populate = originalPopulate;
  }
});

test('assignees exclude superadmin profiles', async () => {
  let query;
  User.find = (filter) => {
    query = filter;
    return {
      select() {
        return this;
      },
      sort() {
        return this;
      },
      limit() {
        return Promise.resolve([]);
      },
    };
  };

  await listTaskAssignees({ user: { _id: 'admin-1', role: 'admin' } }, res());

  assert.deepEqual(query, { status: 'active', role: { $ne: 'superadmin' } });
});

test('assigned user only lists assigned tasks and can mark done', async () => {
  let query;
  Task.find = (filter) => {
    query = filter;
    return {
      populate() {
        return this;
      },
      sort() {
        return this;
      },
      limit() {
        return Promise.resolve([]);
      },
    };
  };

  await listTasks({ user: { _id: 'sales-1', role: 'sales' }, query: {} }, res());
  assert.deepEqual(query, { assignee: 'sales-1' });

  const task = { _id: 'task-1', status: 'To Do', save: async () => {}, populate: async () => {} };
  Task.findOne = async (filter) => {
    query = filter;
    return task;
  };

  await updateTask({ user: { _id: 'sales-1', role: 'sales' }, params: { id: 'task-1' }, body: { status: 'Done' } }, res());

  assert.deepEqual(query, { _id: 'task-1', assignee: 'sales-1' });
  assert.equal(task.status, 'Done');
  assert.equal(task.completedBy, 'sales-1');
  assert.ok(task.completedAt instanceof Date);
});

test('assigned user can add timestamped task note', async () => {
  const task = {
    _id: 'task-1',
    notes: [],
    save: async () => {},
    populate: async () => {},
  };
  let query;
  Task.findOne = async (filter) => {
    query = filter;
    return task;
  };

  const response = res();
  await addTaskNote(
    {
      user: { _id: 'sales-1', role: 'sales' },
      params: { id: 'task-1' },
      body: { title: 'Progress update', description: 'API work is ready for review.' },
    },
    response,
  );

  assert.equal(response.statusCode, 201);
  assert.deepEqual(query, { _id: 'task-1', assignee: 'sales-1' });
  assert.equal(task.notes[0].title, 'Progress update');
  assert.equal(task.notes[0].description, 'API work is ready for review.');
  assert.equal(task.notes[0].createdBy, 'sales-1');
});
