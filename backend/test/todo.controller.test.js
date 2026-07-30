import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import mongoose from 'mongoose';
import { createTodo, listTodoAssignees, listTodos, updateTodo } from '../src/controllers/todo.controller.js';
import { Todo } from '../src/models/todo.model.js';
import { User } from '../src/models/user.model.js';

const originalTodoFind = Todo.find;
const originalTodoFindOne = Todo.findOne;
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
  Todo.find = originalTodoFind;
  Todo.findOne = originalTodoFindOne;
  User.findOne = originalUserFindOne;
});

test('salespeople only list their assigned todos', async () => {
  let query;
  Todo.find = (filter) => {
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

  await listTodos({ user: { _id: 'sales-1', role: 'sales' } }, res());

  assert.deepEqual(query, { assignedTo: 'sales-1' });
});

test('admin can assign todo to any active user', async () => {
  const adminId = new mongoose.Types.ObjectId();
  const assigneeId = new mongoose.Types.ObjectId();
  let saved;
  let userQuery;
  User.findOne = async (filter) => {
    userQuery = filter;
    return { _id: assigneeId, role: 'admin', status: 'active' };
  };
  const originalSave = Todo.prototype.save;
  const originalPopulate = Todo.prototype.populate;
  Todo.prototype.save = async function save() {
    saved = this;
  };
  Todo.prototype.populate = async () => {};

  try {
    const response = res();
    await createTodo(
      {
        user: { _id: adminId, role: 'admin' },
        body: { title: 'Call client', assignedTo: assigneeId, priority: 'High' },
      },
      response,
    );

    assert.equal(response.statusCode, 201);
    assert.deepEqual(userQuery, { _id: assigneeId, status: 'active' });
    assert.equal(saved.title, 'Call client');
    assert.equal(String(saved.assignedTo), String(assigneeId));
    assert.equal(String(saved.createdBy), String(adminId));
  } finally {
    Todo.prototype.save = originalSave;
    Todo.prototype.populate = originalPopulate;
  }
});

test('assigned salesperson can mark todo completed', async () => {
  const todo = {
    _id: 'todo-1',
    assignedTo: 'sales-1',
    status: 'Pending',
    save: async () => {},
    populate: async () => {},
  };
  let query;
  Todo.findOne = async (filter) => {
    query = filter;
    return todo;
  };

  const response = res();
  await updateTodo(
    {
      user: { _id: 'sales-1', role: 'sales' },
      params: { id: 'todo-1' },
      body: { status: 'Completed' },
    },
    response,
  );

  assert.deepEqual(query, { _id: 'todo-1', assignedTo: 'sales-1' });
  assert.equal(todo.status, 'Completed');
  assert.equal(todo.completedBy, 'sales-1');
  assert.ok(todo.completedAt instanceof Date);
});

test('only admins can list todo assignees', async () => {
  const response = res();
  await listTodoAssignees({ user: { _id: 'sales-1', role: 'sales' } }, response);

  assert.equal(response.statusCode, 403);
});
