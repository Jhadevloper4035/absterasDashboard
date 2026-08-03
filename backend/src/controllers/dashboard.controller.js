import { Lead } from '../models/lead.model.js';
import { Task } from '../models/task.model.js';
import { User } from '../models/user.model.js';

const ADMIN_ROLES = ['superadmin', 'admin'];
const CLOSED_LEAD_STATUSES = ['WON', 'LOST', 'ON_HOLD'];
const TEAM_ROLES = ['sales', 'operations', 'accounts', 'designers'];

function canManage(user) {
  return ADMIN_ROLES.includes(user.role);
}

function userLeadQuery(user, extra = {}) {
  return canManage(user) ? extra : { ...extra, owner: user._id };
}

function userTaskQuery(user, extra = {}) {
  return canManage(user) ? extra : { ...extra, assignee: user._id };
}

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function withCurrentMeeting(lead) {
  const data = typeof lead.toObject === 'function' ? lead.toObject() : lead;
  const meetings = (data.meetingHistory || []).filter((meeting) => meeting.status !== 'CANCELLED');
  return { ...data, nextMeeting: meetings.sort((a, b) => new Date(b.startsAt || 0) - new Date(a.startsAt || 0))[0] };
}

function csvValue(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csvRow(values) {
  return values.map(csvValue).join(',');
}

async function getDashboardSummary(user) {
  const { start, end } = todayRange();
  const activeLeadQuery = userLeadQuery(user, { status: { $nin: CLOSED_LEAD_STATUSES } });
  const unassignedLeadQuery = canManage(user) ? { assignmentException: true } : { _id: null };
  const openTaskQuery = userTaskQuery(user, { status: { $ne: 'Done' } });
  const overdueTaskQuery = userTaskQuery(user, { status: { $ne: 'Done' }, dueDate: { $lt: start } });
  const todayTaskQuery = userTaskQuery(user, { status: { $ne: 'Done' }, dueDate: { $gte: start, $lt: end } });
  const meetingQuery = userLeadQuery(user, { meetingHistory: { $elemMatch: { startsAt: { $gte: start, $lt: end }, status: { $ne: 'CANCELLED' } } } });

  const [activeLeads, unassignedLeads, todayMeetings, overdueTasks, dueTodayTasks, teamUsers, recentLeads, priorityTasks] = await Promise.all([
    Lead.countDocuments(activeLeadQuery),
    Lead.countDocuments(unassignedLeadQuery),
    Lead.countDocuments(meetingQuery),
    Task.countDocuments(overdueTaskQuery),
    Task.countDocuments(todayTaskQuery),
    canManage(user) ? User.countDocuments({ role: { $in: TEAM_ROLES }, status: 'active' }) : 1,
    Lead.find(userLeadQuery(user))
      .populate('owner', 'name email role status')
      .sort({ createdAt: -1 })
      .limit(6)
      .lean(),
    Task.find(openTaskQuery)
      .populate('assignee', 'name email role status')
      .sort({ priority: 1, dueDate: 1, createdAt: -1 })
      .limit(6)
      .lean(),
  ]);

  const meetingLeads = await Lead.find(meetingQuery)
    .populate('owner', 'name email role status')
    .sort({ 'meetingHistory.startsAt': 1 })
    .limit(6)
    .lean();

  return {
    stats: { activeLeads, unassignedLeads, todayMeetings, overdueTasks, dueTodayTasks, teamUsers },
    todayMeetings: meetingLeads.map(withCurrentMeeting),
    priorityTasks,
    recentLeads: recentLeads.map(withCurrentMeeting),
  };
}

export async function dashboardSummary(req, res) {
  res.json({
    data: await getDashboardSummary(req.user),
  });
}

export async function dashboardSummaryCsv(req, res) {
  const summary = await getDashboardSummary(req.user);
  const lines = [
    csvRow(['Report', 'Metric', 'Value']),
    csvRow(['Dashboard', 'Active leads', summary.stats.activeLeads]),
    csvRow(['Dashboard', 'Unassigned leads', summary.stats.unassignedLeads]),
    csvRow(['Dashboard', "Today's meetings", summary.stats.todayMeetings]),
    csvRow(['Dashboard', 'Overdue tasks', summary.stats.overdueTasks]),
    csvRow(['Dashboard', 'Tasks due today', summary.stats.dueTodayTasks]),
    csvRow(['Dashboard', 'Team users', summary.stats.teamUsers]),
    '',
    csvRow(['Recent Leads']),
    csvRow(['Name', 'Source', 'Owner', 'Created', 'Status']),
    ...summary.recentLeads.map((lead) => csvRow([lead.name, lead.source, lead.owner?.name || 'Unassigned', lead.createdAt || '', lead.status])),
    '',
    csvRow(['Priority Tasks']),
    csvRow(['Title', 'Assignee', 'Due Date', 'Status', 'Priority']),
    ...summary.priorityTasks.map((task) => csvRow([task.title, task.assignee?.name || 'Unassigned', task.dueDate || '', task.status, task.priority])),
  ];

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="absteras-dashboard-report.csv"');
  res.send(lines.join('\n'));
}
