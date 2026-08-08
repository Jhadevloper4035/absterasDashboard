import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import mongoose from 'mongoose';
import { Notification } from '../src/modules/notifications/models/notification.model.js';
import { User } from '../src/models/user.model.js';
import { renderNotificationEmail, setEmailSenderForTest } from '../src/services/email.service.js';
import { setEmailQueueForTest } from '../src/services/email-queue.service.js';
import { notifyUsers } from '../src/modules/notifications/services/notification.service.js';

const originalInsertMany = Notification.insertMany;
const originalUserFind = User.find;

function setMongoReady() {
  Object.defineProperty(mongoose.connection, 'readyState', { configurable: true, value: 1 });
}

afterEach(() => {
  Notification.insertMany = originalInsertMany;
  User.find = originalUserFind;
  setEmailSenderForTest(undefined);
  setEmailQueueForTest(undefined);
  delete mongoose.connection.readyState;
});

test('notifyUsers stores dashboard notification and queues email delivery', async () => {
  setMongoReady();
  const userId = new mongoose.Types.ObjectId();
  const inserts = [];
  const queued = [];

  Notification.insertMany = (docs) => {
    inserts.push(docs);
    return Promise.resolve(docs.map((doc, index) => ({ ...doc, _id: `notification-${index + 1}` })));
  };
  setEmailSenderForTest(() => Promise.resolve({ messageId: 'ok' }));
  setEmailQueueForTest((job) => { queued.push(job); return Promise.resolve({ id: job.notificationId }); });

  await notifyUsers([userId], { title: 'Task assigned', body: 'Call client', metadata: { type: 'task.created' } });

  assert.equal(inserts.length, 1);
  assert.equal(inserts[0][0].channel, 'in-app');
  assert.deepEqual(queued, [{ notificationId: 'notification-1', attachments: [] }]);
});

test('notifyUsers does not notify the actor who triggered the event', async () => {
  setMongoReady();
  const actorId = new mongoose.Types.ObjectId();
  const assigneeId = new mongoose.Types.ObjectId();
  let inserted;

  Notification.insertMany = (docs) => {
    inserted = docs;
    return Promise.resolve(docs);
  };

  await notifyUsers([actorId, assigneeId], {
    title: 'Task assigned',
    body: 'Call client',
    metadata: { type: 'task.created', fromUserId: actorId },
  });

  assert.equal(inserted.length, 1);
  assert.equal(inserted[0].user, String(assigneeId));
});

test('renderNotificationEmail selects template by notification scenario', () => {
  const email = renderNotificationEmail({
    title: 'Lead assigned',
    body: 'Skyline Tower',
    metadata: { type: 'lead.assigned', leadId: 'lead-1', leadName: 'Skyline Tower', leadCompany: 'Skyline', leadPhone: '9876543210', leadEmail: 'lead@example.com', leadSource: 'Website', assigneeName: 'Sales User', fromName: 'Admin User', fromRole: 'admin' },
  });

  assert.equal(email.template, 'lead.assigned');
  assert.match(email.text, /A new lead has been assigned to you by Admin User/);
  assert.match(email.html, /Skyline Tower/);
  assert.match(email.html, /View Lead in Dashboard/);
});

test('lead closure email uses the supplied closure template fields', () => {
  const email = renderNotificationEmail({
    metadata: { type: 'lead.closed', leadId: 'lead-1', leadName: 'Skyline Tower', leadCompany: 'Skyline', assigneeName: 'Admin User', fromName: 'Sales User', closureStatus: 'WON', closureRemarks: 'Signed', closedAt: '2026-08-08T10:00:00.000Z' },
  });

  assert.equal(email.template, 'lead.closed');
  assert.match(email.text, /Sales User has closed a lead/);
  assert.match(email.html, /Closure Status/);
  assert.match(email.html, /Skyline Tower/);
});

test('task assignment and update emails use the supplied task template fields', () => {
  const assigned = renderNotificationEmail({
    metadata: { type: 'task.created', taskId: 'task-1', taskTitle: 'Prepare proposal', taskPriority: 'High', taskAssigneeName: 'Sales User', taskCreatedBy: 'Admin User', taskDeadline: '2026-08-09T10:00:00.000Z', recipientName: 'Sales User' },
  });
  const updated = renderNotificationEmail({ metadata: { type: 'task.updated', taskTitle: 'Prepare proposal', recipientName: 'Admin User', fromName: 'Sales User' } });

  assert.equal(assigned.template, 'task.created');
  assert.match(assigned.html, /New Task Assigned/);
  assert.match(assigned.html, /Created By/);
  assert.match(assigned.html, /Prepare proposal/);
  assert.equal(updated.template, 'task.updated');
  assert.match(updated.html, /Task Updated/);
});

test('salary slip email uses the payroll template', () => {
  const email = renderNotificationEmail({ title: 'Salary slip — 2026-08', body: 'Net pay: 5000', metadata: { type: 'hr.payroll.payslip' } });
  assert.equal(email.template, 'hr.payroll.payslip');
  assert.match(email.text, /salary slip is ready/i);
});
