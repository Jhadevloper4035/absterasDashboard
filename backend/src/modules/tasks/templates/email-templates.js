import { dashboardUrl, detailRows, htmlEscape, notificationLayout } from '../../../services/email-templates/base.js';

export function taskNotificationEmail(metadata = {}) {
  const assigned = metadata.type === 'task.created';
  const recipientName = metadata.recipientName || metadata.assigneeName || 'there';
  const actorName = metadata.fromName || 'A team member';
  const heading = assigned ? 'New Task Assigned' : 'Task Updated';
  const action = assigned ? 'has assigned you a new task' : 'has updated a task';
  const taskUrl = metadata.taskId ? `${dashboardUrl()}/tasks/${encodeURIComponent(metadata.taskId)}` : dashboardUrl();
  const deadline = metadata.taskDeadline ? new Date(metadata.taskDeadline).toLocaleDateString() : 'Not set';
  const createdOn = metadata.taskCreatedOn ? new Date(metadata.taskCreatedOn).toLocaleString() : 'Not available';
  const text = `Hi ${recipientName},\n\n${actorName} ${action} on the Absteras dashboard.\n\nTask: ${metadata.taskTitle || '-'}\nPriority: ${metadata.taskPriority || '-'}\nAssignee: ${metadata.taskAssigneeName || '-'}\nDeadline: ${deadline}\nWork Type: ${metadata.taskWorkType || '-'}\nCreated By: ${metadata.taskCreatedBy || '-'}\n\nView task: ${taskUrl}`;
  const summary = `<p style="margin:0 0 4px;font-size:16px;color:#0f1f3d;font-weight:700">${htmlEscape(metadata.taskTitle || '-')}</p><p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#4b5563">${htmlEscape(metadata.taskScopeOfWork || '-')}</p>`;
  return { template: metadata.type, subject: `${heading}: ${metadata.taskTitle || 'Task'}`, text, html: notificationLayout({ module: 'Task Management', badge: `${heading} · ${metadata.taskPriority || 'No'} Priority`, heading: `Hi ${recipientName},`, intro: `<strong>${htmlEscape(actorName)}</strong> ${action} on the <strong>Absteras</strong> dashboard. Please review the details below.`, summary, details: detailRows([['Assignee', metadata.taskAssigneeName], ['Deadline', deadline], ['Work Type', metadata.taskWorkType], ['Created By', metadata.taskCreatedBy], ['Created On', createdOn], ['Dependencies', metadata.taskDependencies], ['Attachments', metadata.taskAttachments]]), actionLabel: 'View Task in Dashboard', actionUrl: taskUrl }) };
}
