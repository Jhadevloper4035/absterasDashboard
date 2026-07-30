import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { createLead, deleteLead, getLead, listLeads, updateLead } from '../src/controllers/lead.controller.js';
import { Lead } from '../src/models/lead.model.js';
import { User } from '../src/models/user.model.js';

const originalLeadCreate = Lead.create;
const originalLeadFind = Lead.find;
const originalLeadFindOne = Lead.findOne;
const originalLeadFindOneAndDelete = Lead.findOneAndDelete;
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
  Lead.findOneAndDelete = originalLeadFindOneAndDelete;
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
        phone: '9876543210',
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

test('lead creation requires mobile number', async () => {
  const response = res();
  await createLead(
    {
      body: {
        name: 'Acme',
        source: 'website',
      },
    },
    response,
  );

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.error.message, 'Mobile number is required');
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

test('lead list supports pending assignment filter', async () => {
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

  await listLeads({ user: { _id: 'admin-1', role: 'admin' }, query: { assignmentException: 'true' } }, res());

  assert.deepEqual(query, { assignmentException: true });
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

test('only admins can delete leads', async () => {
  let deletedFilter;
  Lead.findOneAndDelete = async (filter) => {
    deletedFilter = filter;
    return { _id: filter._id };
  };

  const salesResponse = res();
  await deleteLead({ user: { _id: 'sales-1', role: 'sales' }, params: { id: 'lead-1' } }, salesResponse);
  assert.equal(salesResponse.statusCode, 403);
  assert.equal(deletedFilter, undefined);

  const adminResponse = res();
  await deleteLead({ user: { _id: 'admin-1', role: 'admin' }, params: { id: 'lead-1' } }, adminResponse);
  assert.equal(adminResponse.statusCode, 200);
  assert.deepEqual(deletedFilter, { _id: 'lead-1' });
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

test('lead update ignores append-only history and system fields', async () => {
  const statusHistory = [{ from: 'NEW', to: 'ASSIGNED', actor: 'admin-1' }];
  const meetingHistory = [{ title: 'Intro', startsAt: new Date('2026-08-01T10:00'), status: 'SCHEDULED' }];
  const assignmentHistory = [{ previousOwner: undefined, newOwner: 'sales-1', actor: 'admin-1' }];
  const notes = [{ text: 'Original note', createdBy: 'sales-1' }];
  const lead = {
    _id: 'lead-1',
    name: 'Original',
    email: 'old@example.com',
    normalizedEmail: 'old@example.com',
    phone: '+1 555 0000',
    normalizedPhone: '+15550000',
    owner: 'sales-1',
    status: 'ASSIGNED',
    assignmentException: false,
    statusHistory,
    meetingHistory,
    assignmentHistory,
    notes,
    save: async () => {},
    populate: async () => {},
  };
  Lead.findOne = async () => lead;

  const response = res();
  await updateLead(
    {
      user: { _id: 'admin-1', role: 'admin' },
      params: { id: 'lead-1' },
      body: {
        name: 'Updated',
        email: 'new@example.com',
        phone: '+1 555 1111',
        status: 'WON',
        statusHistory: [{ to: 'WON', actor: 'attacker' }],
        meetingHistory: [],
        assignmentHistory: [],
        assignmentException: true,
        notes: [],
        closedAt: new Date('2026-08-02T10:00'),
      },
    },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(lead.name, 'Updated');
  assert.equal(lead.email, 'new@example.com');
  assert.equal(lead.normalizedEmail, undefined);
  assert.equal(lead.phone, '+1 555 1111');
  assert.equal(lead.normalizedPhone, undefined);
  assert.equal(lead.status, 'ASSIGNED');
  assert.equal(lead.assignmentException, false);
  assert.equal(lead.closedAt, undefined);
  assert.equal(lead.statusHistory, statusHistory);
  assert.equal(lead.meetingHistory, meetingHistory);
  assert.equal(lead.assignmentHistory, assignmentHistory);
  assert.equal(lead.notes, notes);
});
