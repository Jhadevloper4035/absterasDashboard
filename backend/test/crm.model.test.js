import assert from 'node:assert/strict';
import { test } from 'node:test';
import mongoose from 'mongoose';
import * as crmModels from '../src/models/crm.model.js';

test('context models are registered', () => {
  assert.deepEqual(
    Object.keys(crmModels).sort(),
    [
      'Activity',
      'Attachment',
      'AuditLog',
      'Campaign',
      'Contact',
      'Customer',
      'Deal',
      'FollowUp',
      'IntegrationEvent',
      'LeadAssignment',
      'LeadSource',
      'LeadStage',
      'LeadStatusHistory',
      'Meeting',
      'MeetingHistory',
      'MeetingMom',
      'MomActionItem',
      'MomVersion',
      'Notification',
      'NotificationDelivery',
      'NotificationPreference',
      'OutboxEvent',
      'Permission',
      'Role',
      'Team',
      'TeamMember',
      'Territory',
      'UserRole',
      'WebhookReceipt',
    ],
  );
});

test('meeting derives end time from duration', async () => {
  const id = new mongoose.Types.ObjectId();
  const meeting = new crmModels.Meeting({
    lead: id,
    owner: id,
    title: 'Discovery',
    type: 'online',
    startAt: new Date('2026-07-28T04:30:00.000Z'),
    timezone: 'Asia/Kolkata',
    durationMinutes: 30,
  });

  await meeting.validate();

  assert.equal(meeting.endAt.toISOString(), '2026-07-28T05:00:00.000Z');
});

test('outbox event defaults to pending', async () => {
  const event = new crmModels.OutboxEvent({
    type: 'lead.created',
    aggregateType: 'Lead',
    aggregateId: new mongoose.Types.ObjectId(),
    payload: { leadId: '1' },
  });

  await event.validate();

  assert.equal(event.status, 'pending');
});

test.after(async () => {
  await mongoose.disconnect();
});
