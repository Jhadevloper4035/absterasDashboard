import { Todo, TODO_PRIORITIES, TODO_STATUSES } from '../models/todo.model.js';
import { User } from '../../../models/user.model.js';

const ADMIN_ROLES = ['superadmin', 'admin'];

function canManageTodos(user) {
  return ADMIN_ROLES.includes(user.role);
}

function todoQueryFor(user, extra = {}) {
  return canManageTodos(user) ? extra : { ...extra, assignedTo: user._id };
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function populateTodo(todo) {
  return todo.populate([
    { path: 'assignedTo', select: 'name email role status' },
    { path: 'createdBy', select: 'name email role status' },
    { path: 'completedBy', select: 'name email role status' },
  ]);
}

function patchTodo(todo, patch, actorId) {
  if (patch.title !== undefined) todo.title = patch.title;
  if (patch.dueDate !== undefined) todo.dueDate = patch.dueDate ? new Date(patch.dueDate) : undefined;
  if (TODO_PRIORITIES.includes(patch.priority)) todo.priority = patch.priority;
  if (TODO_STATUSES.includes(patch.status)) {
    todo.status = patch.status;
    todo.completedAt = patch.status === 'Completed' ? todo.completedAt || new Date() : undefined;
    todo.completedBy = patch.status === 'Completed' ? actorId : undefined;
  }
}

export async function listTodos(req, res) {
  const page = Math.max(Number(req.query.page || 1), 1);
  const limit = Math.min(Math.max(Number(req.query?.limit || 25), 1), 50);
  const extra = {};
  if (TODO_STATUSES.includes(req.query.status)) extra.status = req.query.status;
  if (TODO_PRIORITIES.includes(req.query.priority)) extra.priority = req.query.priority;
  if (req.query.q) extra.title = { $regex: escapeRegex(req.query.q), $options: 'i' };
  if (req.query.fromDate || req.query.toDate) {
    extra.dueDate = {};
    if (req.query.fromDate) extra.dueDate.$gte = new Date(`${req.query.fromDate}T00:00:00.000Z`);
    if (req.query.toDate) extra.dueDate.$lte = new Date(`${req.query.toDate}T23:59:59.999Z`);
  }

  const query = todoQueryFor(req.user, extra);
  const [todos, total] = await Promise.all([
    Todo.find(query)
      .populate('assignedTo', 'name email role status')
      .populate('createdBy', 'name email role status')
      .populate('completedBy', 'name email role status')
      .sort({ dueDate: 1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Todo.countDocuments(query),
  ]);

  res.json({ data: todos, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } });
}

export async function listTodoAssignees(req, res) {
  if (!canManageTodos(req.user)) {
    return res.status(403).json({ error: { message: 'Forbidden' } });
  }

  const users = await User.find({ status: 'active' }).select('name email role status').sort({ name: 1 }).limit(100);
  res.json({ data: users });
}

export async function createTodo(req, res) {
  const assignedTo = canManageTodos(req.user) ? req.body.assignedTo : req.user._id;

  if (!req.body.title?.trim()) {
    return res.status(400).json({ error: { message: 'Task title is required' } });
  }

  const assignee = await User.findOne({ _id: assignedTo, status: 'active' });
  if (!assignee) {
    return res.status(400).json({ error: { message: 'Assign task to an active user' } });
  }

  const todo = new Todo({
    title: req.body.title,
    dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined,
    status: TODO_STATUSES.includes(req.body.status) ? req.body.status : 'Pending',
    priority: TODO_PRIORITIES.includes(req.body.priority) ? req.body.priority : 'Medium',
    assignedTo: assignee._id,
    createdBy: req.user._id,
  });
  if (todo.status === 'Completed') {
    todo.completedAt = new Date();
    todo.completedBy = req.user._id;
  }

  await todo.save();
  await populateTodo(todo);
  return res.status(201).json({ data: todo });
}

export async function updateTodo(req, res) {
  const todo = await Todo.findOne(todoQueryFor(req.user, { _id: req.params.id }));

  if (!todo) {
    return res.status(404).json({ error: { message: 'Todo not found' } });
  }

  if (req.body.assignedTo !== undefined) {
    if (!canManageTodos(req.user)) {
      return res.status(403).json({ error: { message: 'Forbidden' } });
    }

    const assignee = await User.findOne({ _id: req.body.assignedTo, status: 'active' });
    if (!assignee) {
      return res.status(400).json({ error: { message: 'Assign task to an active user' } });
    }
    todo.assignedTo = assignee._id;
  }

  patchTodo(todo, req.body, req.user._id);
  await todo.save();
  await populateTodo(todo);
  return res.json({ data: todo });
}

export async function deleteTodo(req, res) {
  const todo = await Todo.findOneAndDelete(todoQueryFor(req.user, { _id: req.params.id }));

  if (!todo) {
    return res.status(404).json({ error: { message: 'Todo not found' } });
  }

  return res.json({ data: { id: req.params.id } });
}
