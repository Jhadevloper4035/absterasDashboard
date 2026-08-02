import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import mongoose from 'mongoose';
import { addTaskNote, createTask, createTaskWorkType, deleteTaskWorkType, listTaskAssignees, listTaskWorkTypes, listTasks, updateTask } from '../src/controllers/task.controller.js';
import { Task } from '../src/models/task.model.js';
import { TaskWorkType } from '../src/models/task-work-type.model.js';
import { User } from '../src/models/user.model.js';
import { createAttachmentToken } from '../src/services/upload.service.js';

const originalTaskFind = Task.find;
const originalTaskFindOne = Task.findOne;
const originalTaskExists = Task.exists;
const originalTaskWorkTypeFind = TaskWorkType.find;
const originalTaskWorkTypeFindOneAndUpdate = TaskWorkType.findOneAndUpdate;
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
  Task.exists = originalTaskExists;
  TaskWorkType.find = originalTaskWorkTypeFind;
  TaskWorkType.findOneAndUpdate = originalTaskWorkTypeFindOneAndUpdate;
  User.find = originalUserFind;
  User.findOne = originalUserFindOne;
});

test('admin can add role work types and everyone can list configured work types', async () => {
  const adminId = new mongoose.Types.ObjectId();
  let upsertQuery;
  let upsertPatch;
  TaskWorkType.findOneAndUpdate = async (query, patch) => {
    upsertQuery = query;
    upsertPatch = patch;
    return { _id: 'work-type-1', role: query.role, name: patch.$set.name };
  };

  const createResponse = res();
  await createTaskWorkType(
    {
      user: { _id: adminId, role: 'admin' },
      body: { role: 'sales', name: '  Site Visit   Follow Up  ' },
    },
    createResponse,
  );

  assert.equal(createResponse.statusCode, 201);
  assert.deepEqual(upsertQuery, { role: 'sales', normalizedName: 'site visit follow up' });
  assert.equal(upsertPatch.$set.name, 'Site Visit Follow Up');
  assert.equal(upsertPatch.$setOnInsert.createdBy, adminId);

  TaskWorkType.find = () => ({
    sort() {
      return Promise.resolve([{ role: 'sales', name: 'Site Visit Follow Up' }]);
    },
  });

  const listResponse = res();
  await listTaskWorkTypes({ user: { _id: 'sales-1', role: 'sales' } }, listResponse);

  assert.equal(listResponse.statusCode, 200);
  assert.ok(listResponse.body.data.sales.includes('Follow Up'));
  assert.ok(listResponse.body.data.sales.includes('Site Visit Follow Up'));
});

test('admin can delete default role work types', async () => {
  const adminId = new mongoose.Types.ObjectId();
  let upsertQuery;
  let upsertPatch;
  TaskWorkType.findOneAndUpdate = async (query, patch) => {
    upsertQuery = query;
    upsertPatch = patch;
    return { _id: 'work-type-1', role: query.role, name: patch.$set.name, deleted: true };
  };

  const deleteResponse = res();
  await deleteTaskWorkType(
    {
      user: { _id: adminId, role: 'admin' },
      params: { role: 'operations', name: 'Laser Cut' },
    },
    deleteResponse,
  );

  assert.equal(deleteResponse.statusCode, 200);
  assert.deepEqual(upsertQuery, { role: 'operations', normalizedName: 'laser cut' });
  assert.equal(upsertPatch.$set.deleted, true);
  assert.equal(upsertPatch.$set.deletedBy, adminId);

  TaskWorkType.find = () => ({
    sort() {
      return Promise.resolve([{ role: 'operations', name: 'Laser Cut', normalizedName: 'laser cut', deleted: true }]);
    },
  });

  const listResponse = res();
  await listTaskWorkTypes({ user: { _id: 'admin-1', role: 'admin' } }, listResponse);

  assert.equal(listResponse.statusCode, 200);
  assert.ok(!listResponse.body.data.operations.includes('Laser Cut'));
  assert.ok(listResponse.body.data.operations.includes('Coating'));
});

test('assigned users cannot create role work types', async () => {
  const response = res();
  await createTaskWorkType(
    {
      user: { _id: 'sales-1', role: 'sales' },
      body: { role: 'sales', name: 'New sales work' },
    },
    response,
  );

  assert.equal(response.statusCode, 403);
});

test('new tasks get random 6-digit ticket numbers', async () => {
  const userId = new mongoose.Types.ObjectId();
  let existsQuery;
  Task.exists = async (query) => {
    existsQuery = query;
    return null;
  };

  const task = new Task({ title: 'Ticketed task', assignee: userId, createdBy: userId });
  await task.validate();

  assert.match(task.ticketNumber, /^T-\d{6}$/);
  assert.deepEqual(existsQuery, { ticketNumber: task.ticketNumber });
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
  let limit;
  Task.find = (filter) => {
    query = filter;
    return {
      populate() {
        return this;
      },
      sort() {
        return this;
      },
      limit(value) {
        limit = value;
        return Promise.resolve([]);
      },
    };
  };

  await listTasks({ user: { _id: 'sales-1', role: 'sales' }, query: { limit: '5' } }, res());
  assert.deepEqual(query, { assignee: 'sales-1' });
  assert.equal(limit, 5);

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

test('deadline filter lists only open tasks before today', async () => {
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

  await listTasks({ user: { _id: 'admin-1', role: 'admin' }, query: { deadline: 'exceeded' } }, res());

  assert.deepEqual(query.status, { $ne: 'Done' });
  assert.ok(query.dueDate.$lt instanceof Date);
  assert.equal(query.dueDate.$lt.getHours(), 0);
});

test('admin update keeps trusted task attachments', async () => {
  const attachment = {
    key: 'uploads/document/update.pdf',
    checksum: 'update123',
    originalName: 'update.pdf',
    size: 1200,
  };
  attachment.attachmentToken = createAttachmentToken(attachment);
  const task = {
    _id: 'task-1',
    title: 'Task with attachment',
    assignee: 'sales-1',
    createdBy: 'admin-1',
    attachments: [],
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
  await updateTask(
    {
      user: { _id: 'admin-1', role: 'admin' },
      params: { id: 'task-1' },
      body: { attachments: [attachment] },
    },
    response,
  );

  assert.deepEqual(query, { _id: 'task-1' });
  assert.equal(task.attachments.length, 1);
  assert.equal(task.attachments[0].originalName, 'update.pdf');
  assert.equal(response.body.data.attachments[0].originalName, 'update.pdf');
  assert.ok(response.body.data.attachments[0].attachmentToken);
});

test('assigned user can add timestamped task note', async () => {
  const attachment = {
    key: 'uploads/document/note.pdf',
    checksum: 'note123',
    originalName: 'note.pdf',
  };
  attachment.attachmentToken = createAttachmentToken(attachment);
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
      body: {
        title: 'Progress update',
        description: 'API work is ready for review.',
        attachments: [attachment, { key: 'uploads/document/fake.pdf', checksum: 'bad', attachmentToken: 'bad' }],
      },
    },
    response,
  );

  assert.equal(response.statusCode, 201);
  assert.deepEqual(query, { _id: 'task-1', assignee: 'sales-1' });
  assert.equal(task.notes[0].title, 'Progress update');
  assert.equal(task.notes[0].description, 'API work is ready for review.');
  assert.equal(task.notes[0].createdBy, 'sales-1');
  assert.equal(response.body.data.notes[0].attachments.length, 1);
  assert.equal(response.body.data.notes[0].attachments[0].originalName, 'note.pdf');
  assert.ok(response.body.data.notes[0].attachments[0].attachmentToken);
});
