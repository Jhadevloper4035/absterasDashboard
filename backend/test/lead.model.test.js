import assert from 'node:assert/strict';
import { test } from 'node:test';
import mongoose from 'mongoose';
import { LEAD_STATUSES, Lead } from '../src/models/lead.model.js';

test('lead requires a name and source', async () => {
  await assert.rejects(() => new Lead({}).validate(), /Path `name` is required/);
});

test('lead defaults to NEW status', () => {
  const lead = new Lead({ name: 'Acme', source: 'manual' });

  assert.equal(lead.status, 'NEW');
  assert.equal(lead.sourceType, 'manual');
  assert.deepEqual(LEAD_STATUSES, [
    'NEW',
    'ASSIGNED',
    'ACCEPTED',
    'CONTACT_ATTEMPTED',
    'CONTACTED',
    'QUALIFIED',
    'MEETING_SCHEDULED',
    'PROPOSAL_SENT',
    'NEGOTIATION',
    'WON',
    'LOST',
    'ON_HOLD',
  ]);
});

test('lead notes support paragraph text and images', async () => {
  const lead = new Lead({
    name: 'Acme',
    source: 'manual',
    notes: [
      {
        text: 'Customer wants a detailed proposal with multiple paragraphs.\nFollow up next week.',
        images: [{ url: 'https://example.com/site-photo.jpg', name: 'site-photo.jpg' }],
      },
    ],
  });

  await lead.validate();

  assert.equal(lead.notes[0].text.includes('multiple paragraphs'), true);
  assert.equal(lead.notes[0].images[0].url, 'https://example.com/site-photo.jpg');
});

test('lead stores assignment, status history, and next action context', async () => {
  const owner = new mongoose.Types.ObjectId();
  const lead = new Lead({
    name: 'Acme',
    source: 'website',
    email: ' Sales@Example.COM ',
    phone: '+91 98765 43210',
    owner,
    status: 'ASSIGNED',
    statusHistory: [{ from: 'NEW', to: 'ASSIGNED', reason: 'Round robin' }],
    assignmentHistory: [{ newOwner: owner, reason: 'Round robin', rule: 'default' }],
    nextAction: {
      type: 'call',
      dueAt: new Date('2026-07-28T04:30:00.000Z'),
      timezone: 'Asia/Kolkata',
      priority: 'high',
      notes: 'Call before sending proposal.',
    },
  });

  await lead.validate();

  assert.equal(lead.normalizedEmail, 'sales@example.com');
  assert.equal(lead.normalizedPhone, '+919876543210');
  assert.equal(lead.assignmentException, false);
  assert.equal(lead.nextAction.status, 'pending');
});

test('active lead without owner goes to assignment exception queue', async () => {
  const lead = new Lead({ name: 'Acme', source: 'api', status: 'NEW' });

  await lead.validate();

  assert.equal(lead.assignmentException, true);
});

test('lost and on-hold leads require reasons', async () => {
  await assert.rejects(
    () => new Lead({ name: 'Acme', source: 'manual', status: 'LOST' }).validate(),
    /LOST requires a reason/,
  );

  await assert.rejects(
    () => new Lead({ name: 'Acme', source: 'manual', status: 'ON_HOLD' }).validate(),
    /ON_HOLD requires a reason/,
  );
});

test.after(async () => {
  await mongoose.disconnect();
});
