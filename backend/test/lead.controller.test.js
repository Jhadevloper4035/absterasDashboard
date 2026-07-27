import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { createLead, getLead, listLeads, updateLead } from '../src/controllers/lead.controller.js';
import { Lead } from '../src/models/lead.model.js';
import { User } from '../src/models/user.model.js';

const originalLeadCreate = Lead.create;
const originalLeadFind = Lead.find;
const originalLeadFindOne = Lead.findOne;
const originalLeadCountDocuments = Lead.countDocuments;
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
  Lead.create = originalLeadCreate;
  Lead.find = originalLeadFind;
  Lead.findOne = originalLeadFindOne;
  Lead.countDocuments = originalLeadCountDocuments;
  User.findOne = originalUserFindOne;
});

test('created leads always enter the admin assignment queue', async () => {
  let payload;
  Lead.create = async (body) => {
    payload = body;
    return body;
  };

  const response = res();
  await createLead(
    {
      body: {
        name: 'Acme',
        source: 'website',
        owner: 'sales-1',
        status: 'ASSIGNED',
      },
    },
    response,
  );

  assert.equal(response.statusCode, 201);
  assert.equal(payload.owner, undefined);
  assert.equal(payload.status, 'NEW');
  assert.equal(payload.assignmentException, true);
});

test('salespeople only list their assigned leads', async () => {
  let query;
  Lead.find = (filter) => {
    query = filter;
    return {
      populate() {
        return this;
      },
      sort() {
        return this;
      },
      skip() {
        return this;
      },
      limit() {
        return Promise.resolve([]);
      },
    };
  };
  Lead.countDocuments = async () => 0;

  await listLeads({ user: { _id: 'sales-1', role: 'sales' }, query: {} }, res());

  assert.deepEqual(query, { owner: 'sales-1' });
});

test('lead list supports status and upcoming meeting filters', async () => {
  let query;
  Lead.find = (filter) => {
    query = filter;
    return {
      populate() {
        return this;
      },
      sort() {
        return this;
      },
      skip() {
        return this;
      },
      limit() {
        return Promise.resolve([]);
      },
    };
  };
  Lead.countDocuments = async () => 0;

  await listLeads({ user: { _id: 'admin-1', role: 'admin' }, query: { status: 'WON', upcomingMeeting: 'true' } }, res());

  assert.equal(query.status, 'WON');
  assert.ok(query['meetingHistory.startsAt'].$gte instanceof Date);
});

test('lead list ignores invalid status filters', async () => {
  let query;
  Lead.find = (filter) => {
    query = filter;
    return {
      populate() {
        return this;
      },
      sort() {
        return this;
      },
      skip() {
        return this;
      },
      limit() {
        return Promise.resolve([]);
      },
    };
  };
  Lead.countDocuments = async () => 0;

  await listLeads({ user: { _id: 'admin-1', role: 'admin' }, query: { status: 'NOT_REAL' } }, res());

  assert.deepEqual(query, {});
});

test('lead detail populates meeting schedule history', async () => {
  const populated = [];
  Lead.findOne = () => ({
    populate(path) {
      populated.push(path);
      return this;
    },
  });

  const response = res();
  await getLead({ user: { _id: 'admin-1', role: 'admin' }, params: { id: 'lead-1' } }, response);

  assert.equal(response.statusCode, 200);
  assert.ok(populated.includes('meetingHistory.scheduledBy'));
});

test('salespeople cannot assign leads', async () => {
  Lead.findOne = async () => ({ _id: 'lead-1', owner: 'sales-1' });

  const response = res();
  await updateLead(
    {
      user: { _id: 'sales-1', role: 'sales' },
      params: { id: 'lead-1' },
      body: { owner: 'sales-2' },
    },
    response,
  );

  assert.equal(response.statusCode, 403);
});

test('admin and assigned salespeople can add lead notes', async () => {
  const queries = [];
  const lead = {
    _id: 'lead-1',
    owner: 'sales-1',
    notes: [],
    save: async () => {},
    populate: async () => {},
  };
  Lead.findOne = async (filter) => {
    queries.push(filter);
    return lead;
  };

  await updateLead(
    {
      user: { _id: 'admin-1', role: 'admin' },
      params: { id: 'lead-1' },
      body: { noteText: 'Admin checked requirement' },
    },
    res(),
  );
  await updateLead(
    {
      user: { _id: 'sales-1', role: 'sales' },
      params: { id: 'lead-1' },
      body: { noteText: 'Sales called customer' },
    },
    res(),
  );

  assert.deepEqual(queries, [{ _id: 'lead-1' }, { _id: 'lead-1', owner: 'sales-1' }]);
  assert.deepEqual(
    lead.notes.map((note) => [note.text, note.createdBy]),
    [
      ['Admin checked requirement', 'admin-1'],
      ['Sales called customer', 'sales-1'],
    ],
  );
});

test('meeting scheduling requires an assigned lead', async () => {
  Lead.findOne = async () => ({ _id: 'lead-1', owner: undefined });

  const response = res();
  await updateLead(
    {
      user: { _id: 'admin-1', role: 'admin' },
      params: { id: 'lead-1' },
      body: { nextMeeting: { startsAt: '2026-08-01T10:00', title: 'Site visit' } },
    },
    response,
  );

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.error.message, 'Assign lead before scheduling a meeting');
});

test('meeting scheduling stores next meeting and status history', async () => {
  const lead = {
    _id: 'lead-1',
    owner: 'sales-1',
    status: 'ASSIGNED',
    statusHistory: [],
    meetingHistory: [],
    save: async () => {},
    populate: async () => {},
  };
  Lead.findOne = async () => lead;

  const response = res();
  await updateLead(
    {
      user: { _id: 'admin-1', role: 'admin' },
      params: { id: 'lead-1' },
      body: { nextMeeting: { startsAt: '2026-08-01T10:00', title: 'Site visit', notes: 'Bring samples' } },
    },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(lead.status, 'MEETING_SCHEDULED');
  assert.equal(lead.meetingHistory[0].notes, 'Bring samples');
  assert.equal(lead.meetingHistory[0].status, 'SCHEDULED');
  assert.equal(response.body.data.nextMeeting.notes, 'Bring samples');
  assert.equal(lead.statusHistory[0].to, 'MEETING_SCHEDULED');
});

test('meeting cancellation appends history and clears active next meeting', async () => {
  const lead = {
    _id: 'lead-1',
    owner: 'sales-1',
    status: 'MEETING_SCHEDULED',
    statusHistory: [],
    meetingHistory: [
      {
        title: 'Site visit',
        startsAt: new Date('2026-08-01T10:00'),
        notes: 'Bring samples',
        scheduledBy: 'admin-1',
        scheduledAt: new Date('2026-07-31T10:00'),
        status: 'SCHEDULED',
      },
    ],
    save: async () => {},
    populate: async () => {},
  };
  Lead.findOne = async () => lead;

  const response = res();
  await updateLead(
    {
      user: { _id: 'admin-1', role: 'admin' },
      params: { id: 'lead-1' },
      body: { cancelMeeting: true, cancelMeetingNote: 'Client postponed' },
    },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(lead.status, 'CONTACTED');
  assert.equal(lead.meetingHistory[1].status, 'CANCELLED');
  assert.equal(lead.meetingHistory[1].notes, 'Client postponed');
  assert.equal(response.body.data.nextMeeting, undefined);
});

test('admin can assign and schedule meeting together', async () => {
  const lead = {
    _id: 'lead-1',
    owner: undefined,
    status: 'NEW',
    assignmentHistory: [],
    statusHistory: [],
    meetingHistory: [],
    save: async () => {},
    populate: async () => {},
  };
  Lead.findOne = async () => lead;
  User.findOne = async () => ({ _id: 'sales-1', role: 'sales', status: 'active' });

  const response = res();
  await updateLead(
    {
      user: { _id: 'admin-1', role: 'admin' },
      params: { id: 'lead-1' },
      body: {
        owner: 'sales-1',
        nextMeeting: { startsAt: '2026-08-01T10:00', title: 'Site visit', notes: 'Bring samples' },
      },
    },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(lead.owner, 'sales-1');
  assert.equal(lead.status, 'MEETING_SCHEDULED');
  assert.equal(lead.meetingHistory[0].notes, 'Bring samples');
  assert.equal(response.body.data.nextMeeting.notes, 'Bring samples');
});
