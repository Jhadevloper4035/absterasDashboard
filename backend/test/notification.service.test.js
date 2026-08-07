import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import mongoose from 'mongoose';
import { Notification } from '../src/modules/notifications/models/notification.model.js';
import { User } from '../src/models/user.model.js';
import { renderNotificationEmail, setEmailSenderForTest } from '../src/services/email.service.js';
import { notifyUsers } from '../src/modules/notifications/services/notification.service.js';

const originalInsertMany = Notification.insertMany;
const originalUserFind = User.find;

function setMongoReady() {
  Object.defineProperty(mongoose.connection, 'readyState', { configurable: true, value: 1 });
}

function waitForEmailJob() {
  return new Promise((resolve) => setImmediate(resolve));
}

afterEach(() => {
  Notification.insertMany = originalInsertMany;
  User.find = originalUserFind;
  setEmailSenderForTest(undefined);
  delete mongoose.connection.readyState;
});

test('notifyUsers stores dashboard notification and sends email to user email', async () => {
  setMongoReady();
  const userId = new mongoose.Types.ObjectId();
  const inserts = [];
  const sent = [];

  Notification.insertMany = (docs) => {
    inserts.push(docs);
    return Promise.resolve(docs);
  };
  User.find = (query) => {
    assert.deepEqual(query, { _id: { $in: [String(userId)] }, status: 'active' });
    return {
      select(field) {
        assert.equal(field, 'email');
        return Promise.resolve([{ _id: userId, email: 'sales@example.com' }]);
      },
    };
  };
  setEmailSenderForTest((message) => {
    sent.push(message);
    return Promise.resolve({ messageId: 'ok' });
  });

  await notifyUsers([userId], { title: 'Task assigned', body: 'Call client', metadata: { type: 'task.created' } });
  await waitForEmailJob();
  await waitForEmailJob();

  assert.equal(inserts.length, 2);
  assert.equal(inserts[0][0].channel, 'in-app');
  assert.equal(inserts[1][0].channel, 'email');
  assert.equal(inserts[1][0].status, 'sent');
  assert.equal(sent[0].to, 'sales@example.com');
  assert.equal(sent[0].template, 'task.created');
  assert.equal(sent[0].subject, 'Task assigned');
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
    metadata: { type: 'lead.assigned', fromName: 'Admin User', fromRole: 'admin' },
  });

  assert.equal(email.template, 'lead.assigned');
  assert.match(email.text, /A lead has been assigned to you/);
  assert.match(email.text, /From: Admin User \(admin\)/);
});

test('salary slip email uses the payroll template', () => {
  const email = renderNotificationEmail({ title: 'Salary slip — 2026-08', body: 'Net pay: 5000', metadata: { type: 'hr.payroll.payslip' } });
  assert.equal(email.template, 'hr.payroll.payslip');
  assert.match(email.text, /salary slip is ready/i);
});
