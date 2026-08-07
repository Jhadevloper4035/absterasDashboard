import { Task, TASK_PRIORITIES, TASK_STATUSES } from '../models/task.model.js';
import { DEFAULT_TASK_WORK_TYPES, TASK_WORK_TYPE_ROLES, TaskWorkType, normalizeTaskWorkType } from '../models/task-work-type.model.js';
import { User } from '../../../models/user.model.js';
import { auditEvent } from '../../../services/audit.service.js';
import { notifyUsers } from '../../../services/notification.service.js';
import { signAttachmentUrls, trustedAttachment } from '../../../services/upload.service.js';

const ADMIN_ROLES = ['superadmin', 'admin'];
const TASK_ASSIGNEE_ROLES = ['sales', 'operations', 'accounts', 'designers'];

function canManageTasks(user) {
  return ADMIN_ROLES.includes(user.role);
}

function taskQueryFor(user, extra = {}) {
  return canManageTasks(user) ? extra : { ...extra, assignee: user._id };
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
  data.notes = await Promise.all(
    (data.notes || []).map(async (note) => ({
      ...note,
      attachments: await signAttachmentUrls(note.attachments || []),
    })),
  );
  return data;
}

async function findAssignee(id) {
  return User.findOne({ _id: id, status: 'active', $or: [{ role: { $in: TASK_ASSIGNEE_ROLES } }, { additionalRoles: { $in: TASK_ASSIGNEE_ROLES } }] });
}

function notificationMetadata(type, taskId, actor) {
  return {
    type,
    taskId,
    fromUserId: actor._id,
    fromName: actor.name || actor.email || 'User',
    fromRole: actor.role,
  };
}

export async function listTaskAssignees(req, res) {
  if (!canManageTasks(req.user)) {
    return res.status(403).json({ error: { message: 'Forbidden' } });
  }

  const users = await User.find({ status: 'active', $or: [{ role: { $in: TASK_ASSIGNEE_ROLES } }, { additionalRoles: { $in: TASK_ASSIGNEE_ROLES } }] }).select('name email role additionalRoles status').sort({ name: 1 }).limit(1000);
  return res.json({ data: users });
}

export async function listTaskWorkTypes(req, res) {
  const workTypes = Object.fromEntries(Object.entries(DEFAULT_TASK_WORK_TYPES).map(([role, names]) => [role, [...names]]));
  const customWorkTypes = await TaskWorkType.find({}).sort({ role: 1, name: 1 });

  customWorkTypes.forEach((item) => {
    const normalizedName = item.normalizedName || item.name.toLowerCase();
    if (item.deleted) {
      workTypes[item.role] = (workTypes[item.role] || []).filter((name) => name.toLowerCase() !== normalizedName);
      return;
    }
    workTypes[item.role] = [...new Set([...(workTypes[item.role] || []), item.name])].sort();
  });

  return res.json({ data: workTypes });
}

export async function createTaskWorkType(req, res) {
  if (!canManageTasks(req.user)) {
    return res.status(403).json({ error: { message: 'Forbidden' } });
  }

  const role = String(req.body.role || '').trim();
  const name = normalizeTaskWorkType(req.body.name);

  if (!TASK_WORK_TYPE_ROLES.includes(role)) {
    return res.status(400).json({ error: { message: 'Select a valid role' } });
  }
  if (!name) {
    return res.status(400).json({ error: { message: 'Work type name is required' } });
  }
  if (name.length > 60) {
    return res.status(400).json({ error: { message: 'Work type name must be 60 characters or less' } });
  }

  const workType = await TaskWorkType.findOneAndUpdate(
    { role, normalizedName: name.toLowerCase() },
    { $setOnInsert: { role, normalizedName: name.toLowerCase(), createdBy: req.user._id }, $set: { name, deleted: false }, $unset: { deletedBy: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  await auditEvent(req, { action: 'task_work_type.create', entity: 'task_work_type', entityId: `${role}:${name}`, after: { role, name } });
  return res.status(201).json({ data: workType });
}

export async function deleteTaskWorkType(req, res) {
  if (!canManageTasks(req.user)) {
    return res.status(403).json({ error: { message: 'Forbidden' } });
  }

  const role = String(req.params.role || '').trim();
  const name = normalizeTaskWorkType(req.params.name);

  if (!TASK_WORK_TYPE_ROLES.includes(role)) {
    return res.status(400).json({ error: { message: 'Select a valid role' } });
  }
  if (!name) {
    return res.status(400).json({ error: { message: 'Work type name is required' } });
  }

  await TaskWorkType.findOneAndUpdate(
    { role, normalizedName: name.toLowerCase() },
    { $setOnInsert: { role, normalizedName: name.toLowerCase(), createdBy: req.user._id }, $set: { name, deleted: true, deletedBy: req.user._id } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  await auditEvent(req, { action: 'task_work_type.delete', entity: 'task_work_type', entityId: `${role}:${name}`, before: { role, name } });
  return res.json({ data: { role, name } });
}

export async function listTasks(req, res) {
  const page = Math.max(Number(req.query.page || 1), 1);
  const limit = Math.min(Math.max(Number(req.query?.limit || 25), 1), 50);
  const extra = req.query.status ? { status: req.query.status } : {};
  if (req.query.deadline === 'exceeded') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    extra.status = { $ne: 'Done' };
    extra.dueDate = { $lt: today };
  }
  if (canManageTasks(req.user) && req.query.group) {
    const users = await User.find({ status: 'active', $or: [{ role: req.query.group }, { additionalRoles: req.query.group }] }).select('_id').limit(1000);
    extra.assignee = { $in: users.map((user) => user._id) };
  }
  if (canManageTasks(req.user) && req.query.assignee) extra.assignee = req.query.assignee;
  if (req.query.workType) extra.projectEpic = req.query.workType;
  if (req.query.priority) extra.priority = req.query.priority;
  if (req.query.q) {
    const search = { $regex: escapeRegex(req.query.q), $options: 'i' };
    extra.$or = [{ title: search }, { ticketNumber: search }];
  }
  if (req.query.fromDate || req.query.toDate) {
    extra.dueDate = { ...(extra.dueDate || {}) };
    if (req.query.fromDate) extra.dueDate.$gte = new Date(`${req.query.fromDate}T00:00:00.000Z`);
    if (req.query.toDate) extra.dueDate.$lte = new Date(`${req.query.toDate}T23:59:59.999Z`);
  }

  const query = taskQueryFor(req.user, extra);
  const [tasks, total] = await Promise.all([
    Task.find(query)
      .populate('assignee', 'name email role status')
      .populate('createdBy', 'name email role status')
      .populate('completedBy', 'name email role status')
      .sort({ dueDate: 1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Task.countDocuments(query),
  ]);

  return res.json({ data: await Promise.all(tasks.map(taskData)), meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } });
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
    return res.status(400).json({ error: { message: 'Assign task to an active sales, operations, accounts, or designers user' } });
  }

  const task = new Task({ createdBy: req.user._id, assignee: assignee._id });
  patchTask(task, req.body, req.user._id);
  await task.save();
  await populateTask(task);
  await notifyUsers([task.assignee], {
    title: `Task assigned: ${task.ticketNumber}`,
    body: task.title,
    metadata: notificationMetadata('task.created', task._id, req.user),
  });
  return res.status(201).json({ data: await taskData(task) });
}

export async function updateTask(req, res) {
  const task = await Task.findOne(taskQueryFor(req.user, { _id: req.params.id }));
  const previousStatus = task?.status;
  const previousAssignee = task?.assignee;
  if (!task) {
    return res.status(404).json({ error: { message: 'Task not found' } });
  }

  if (req.body.assignee !== undefined) {
    if (!canManageTasks(req.user)) {
      return res.status(403).json({ error: { message: 'Forbidden' } });
    }

    const assignee = await findAssignee(req.body.assignee);
    if (!assignee) {
      return res.status(400).json({ error: { message: 'Assign task to an active sales, operations, accounts, or designers user' } });
    }
    task.assignee = assignee._id;
  }

  patchTask(task, req.body, req.user._id);
  await task.save();
  if (previousStatus !== task.status) {
    await auditEvent(req, { action: 'task.status', entity: 'task', entityId: task._id, before: { status: previousStatus }, after: { status: task.status } });
  }
  if (String(previousAssignee || '') !== String(task.assignee || '')) {
    await auditEvent(req, { action: 'task.assign', entity: 'task', entityId: task._id, before: { assignee: previousAssignee }, after: { assignee: task.assignee } });
  }
  await populateTask(task);
  await notifyUsers([task.assignee, task.createdBy].filter((id) => String(id || '') !== String(req.user._id)), {
    title: `${task.status === 'Done' ? 'Task completed' : 'Task updated'}: ${task.ticketNumber}`,
    body: task.title,
    metadata: notificationMetadata('task.updated', task._id, req.user),
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
    attachments: cleanAttachments(req.body.attachments),
    createdBy: req.user._id,
  });
  await task.save();
  await populateTask(task);
  await notifyUsers([task.assignee, task.createdBy].filter((id) => String(id || '') !== String(req.user._id)), {
    title: `Task note added: ${task.ticketNumber}`,
    body: task.title,
    metadata: notificationMetadata('task.note', task._id, req.user),
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

  await auditEvent(req, { action: 'task.delete', entity: 'task', entityId: task._id, before: { assignee: task.assignee, status: task.status } });
  return res.json({ data: { id: req.params.id } });
}
