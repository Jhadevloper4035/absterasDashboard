import { dashboardUrl, detailRows, htmlEscape, notificationLayout } from '../../../services/email-templates/base.js';

export function leadAssignedEmail(metadata = {}) {
  const assignerName = metadata.fromName || 'A team member';
  const leadUrl = metadata.leadId ? `${dashboardUrl()}/leads/${encodeURIComponent(metadata.leadId)}` : dashboardUrl();
  const text = `Hi ${metadata.assigneeName || 'there'},\n\nA new lead has been assigned to you by ${assignerName}.\n\nLead: ${metadata.leadName || '-'}\nCompany: ${metadata.leadCompany || '-'}\nPhone: ${metadata.leadPhone || '-'}\nEmail: ${metadata.leadEmail || '-'}\nSource: ${metadata.leadSource || '-'}\n\nView lead: ${leadUrl}`;
  return { template: 'lead.assigned', subject: `New Lead Assigned: ${metadata.leadName || 'Lead'}`, text, html: notificationLayout({ module: 'Lead Management', badge: 'New Lead Assigned', heading: `Hi ${metadata.assigneeName || 'there'},`, intro: `A new lead has been assigned to you on the <strong>Absteras</strong> dashboard by <strong>${htmlEscape(assignerName)}</strong>. Please review the details below.`, details: detailRows([['Lead Name', metadata.leadName], ['Assigned By', assignerName], ['Company', metadata.leadCompany], ['Phone', metadata.leadPhone], ['Email', metadata.leadEmail], ['Source', metadata.leadSource], ['Assigned On', metadata.assignedAt ? new Date(metadata.assignedAt).toLocaleString() : new Date().toLocaleString()]]), actionLabel: 'View Lead in Dashboard', actionUrl: leadUrl }) };
}

export function leadClosedEmail(metadata = {}) {
  const assignerName = metadata.assigneeName || 'there';
  const closedByName = metadata.fromName || 'A team member';
  const leadUrl = metadata.leadId ? `${dashboardUrl()}/leads/${encodeURIComponent(metadata.leadId)}` : dashboardUrl();
  const closedDate = metadata.closedAt ? new Date(metadata.closedAt).toLocaleString() : new Date().toLocaleString();
  const text = `Hi ${assignerName},\n\n${closedByName} has closed a lead you assigned to them.\n\nLead: ${metadata.leadName || '-'}\nCompany: ${metadata.leadCompany || '-'}\nStatus: ${metadata.closureStatus || '-'}\nRemarks: ${metadata.closureRemarks || '-'}\nClosed on: ${closedDate}\n\nView lead: ${leadUrl}`;
  return { template: 'lead.closed', subject: `Lead Closed: ${metadata.leadName || 'Lead'}`, text, html: notificationLayout({ module: 'Lead Management', badge: 'Lead Closed', badgeColor: '#e7f6ed', badgeText: '#0e7a41', heading: `Hi ${assignerName},`, intro: `This is a confirmation that <strong>${htmlEscape(closedByName)}</strong> has closed a lead you assigned to them on the <strong>Absteras</strong> dashboard.`, details: detailRows([['Lead Name', metadata.leadName], ['Assigned By', assignerName], ['Company', metadata.leadCompany], ['Closed By', closedByName], ['Closure Status', metadata.closureStatus], ['Remarks', metadata.closureRemarks], ['Closed On', closedDate]]), actionLabel: 'View Lead in Dashboard', actionUrl: leadUrl }) };
}
