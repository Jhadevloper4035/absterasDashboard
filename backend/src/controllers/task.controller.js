import { Task, TASK_PRIORITIES, TASK_STATUSES } from '../models/task.model.js';
import { User } from '../models/user.model.js';
import { notifyUsers } from '../services/notification.service.js';
import { signAttachmentUrls, trustedAttachment } from '../services/upload.service.js';

const ADMIN_ROLES = ['superadmin', 'admin'];

function canManageTasks(user) {
  return ADMIN_ROLES.includes(user.role);
}

function taskQueryFor(user, extra = {}) {
  return canManageTasks(user) ? extra : { ...extra, assignee: user._id };
}

function cleanLabels(labels) {
  return (Array.isArray(labels) ? labels : String(labels || '').split(','))
    .map((label) => String(label).trim())
    .filter(Boolean)
    .slice(0, 12);
}

function cleanAttachments(attachments) {
  return (Array.isArray(attachments) ? attachments : [])
    .map(trustedAttachment)
    .filter(Boolean)
    .slice(0, 10)
    .map(({ key, contentType, originalName, size, checksum }) => ({ key, contentType, originalName, size, checksum }));
}

function patchTask(task, body, actorId) {
  if (body.title !== undefined) task.title = body.title;
  if (body.description !== undefined) task.description = body.description;
  if (body.acceptanceCriteria !== undefined) task.acceptanceCriteria = body.acceptanceCriteria;
  if (TASK_PRIORITIES.includes(body.priority)) task.priority = body.priority;
  if (TASK_STATUSES.includes(body.status)) {
    task.status = body.status;
    task.completedAt = body.status === 'Done' ? task.completedAt || new Date() : undefined;
    task.completedBy = body.status === 'Done' ? actorId : undefined;
  }
  if (body.dueDate !== undefined) task.dueDate = body.dueDate ? new Date(body.dueDate) : undefined;
  if (body.projectEpic !== undefined) task.projectEpic = body.projectEpic;
  if (body.labels !== undefined) task.labels = cleanLabels(body.labels);
  if (body.dependenciesBlockers !== undefined) task.dependenciesBlockers = body.dependenciesBlockers;
  if (body.technicalNotes !== undefined) task.technicalNotes = body.technicalNotes;
  if (body.attachments !== undefined) task.attachments = cleanAttachments(body.attachments);
  if (body.estimate !== undefined) task.estimate = body.estimate;
  if (body.definitionOfDone !== undefined) task.definitionOfDone = body.definitionOfDone;
}

function populateTask(task) {
  return task.populate([
    { path: 'assignee', select: 'name email role status' },
    { path: 'createdBy', select: 'name email role status' },
    { path: 'completedBy', select: 'name email role status' },
    { path: 'notes.createdBy', select: 'name email role status' },
  ]);
}

async function taskData(task) {
  const data = typeof task.toObject === 'function' ? task.toObject() : task;
  data.attachments = await signAttachmentUrls(data.attachments || []);
  return data;
}

async function findAssignee(id) {
  return User.findOne({ _id: id, status: 'active', role: { $ne: 'superadmin' } });
}

export async function listTaskAssignees(req, res) {
  if (!canManageTasks(req.user)) {
    return res.status(403).json({ error: { message: 'Forbidden' } });
  }

  const users = await User.find({ status: 'active', role: { $ne: 'superadmin' } }).select('name email role status').sort({ name: 1 }).limit(1000);
  return res.json({ data: users });
}

export async function listTasks(req, res) {
  const extra = req.query.status ? { status: req.query.status } : {};
  const tasks = await Task.find(taskQueryFor(req.user, extra))
    .populate('assignee', 'name email role status')
    .populate('createdBy', 'name email role status')
    .populate('completedBy', 'name email role status')
    .sort({ dueDate: 1, createdAt: -1 })
    .limit(100);

  return res.json({ data: await Promise.all(tasks.map(taskData)) });
}

export async function getTask(req, res) {
  const task = await Task.findOne(taskQueryFor(req.user, { _id: req.params.id }));
  if (!task) {
    return res.status(404).json({ error: { message: 'Task not found' } });
  }

  await populateTask(task);
  return res.json({ data: await taskData(task) });
}

export async function createTask(req, res) {
  if (!canManageTasks(req.user)) {
    return res.status(403).json({ error: { message: 'Forbidden' } });
  }

  if (!req.body.title?.trim()) {
    return res.status(400).json({ error: { message: 'Task title is required' } });
  }

  const assignee = await findAssignee(req.body.assignee);
  if (!assignee) {
    return res.status(400).json({ error: { message: 'Assign task to an active non-superadmin user' } });
  }

  const task = new Task({ createdBy: req.user._id, assignee: assignee._id });
  patchTask(task, req.body, req.user._id);
  await task.save();
  await populateTask(task);
  await notifyUsers([task.assignee], {
    title: 'Task assigned',
    body: task.title,
    metadata: { type: 'task.created', taskId: task._id },
  });
  return res.status(201).json({ data: await taskData(task) });
}

export async function updateTask(req, res) {
  const task = await Task.findOne(taskQueryFor(req.user, { _id: req.params.id }));
  if (!task) {
    return res.status(404).json({ error: { message: 'Task not found' } });
  }

  if (req.body.assignee !== undefined) {
    if (!canManageTasks(req.user)) {
      return res.status(403).json({ error: { message: 'Forbidden' } });
    }

    const assignee = await findAssignee(req.body.assignee);
    if (!assignee) {
      return res.status(400).json({ error: { message: 'Assign task to an active non-superadmin user' } });
    }
    task.assignee = assignee._id;
  }

  patchTask(task, req.body, req.user._id);
  await task.save();
  await populateTask(task);
  await notifyUsers([task.assignee, task.createdBy].filter((id) => String(id || '') !== String(req.user._id)), {
    title: task.status === 'Done' ? 'Task completed' : 'Task updated',
    body: task.title,
    metadata: { type: 'task.updated', taskId: task._id },
  });
  return res.json({ data: await taskData(task) });
}

export async function addTaskNote(req, res) {
  const task = await Task.findOne(taskQueryFor(req.user, { _id: req.params.id }));
  if (!task) {
    return res.status(404).json({ error: { message: 'Task not found' } });
  }

  if (!req.body.title?.trim() || !req.body.description?.trim()) {
    return res.status(400).json({ error: { message: 'Note title and description are required' } });
  }

  task.notes.push({
    title: req.body.title,
    description: req.body.description,
    createdBy: req.user._id,
  });
  await task.save();
  await populateTask(task);
  await notifyUsers([task.assignee, task.createdBy].filter((id) => String(id || '') !== String(req.user._id)), {
    title: 'Task note added',
    body: task.title,
    metadata: { type: 'task.note', taskId: task._id },
  });
  return res.status(201).json({ data: await taskData(task) });
}

export async function deleteTask(req, res) {
  if (!canManageTasks(req.user)) {
    return res.status(403).json({ error: { message: 'Forbidden' } });
  }

  const task = await Task.findOneAndDelete({ _id: req.params.id });
  if (!task) {
    return res.status(404).json({ error: { message: 'Task not found' } });
  }

  return res.json({ data: { id: req.params.id } });
}
