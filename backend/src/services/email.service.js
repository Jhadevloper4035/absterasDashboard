import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { htmlEscape } from './email-templates/base.js';
import { leadAssignedEmail, leadClosedEmail } from '../modules/leads/templates/email-templates.js';
import { taskNotificationEmail } from '../modules/tasks/templates/email-templates.js';

let transporter;
let testSender;

const EMAIL_TEMPLATES = {
  'lead.meeting': { heading: 'Meeting scheduled', intro: 'A lead meeting has been scheduled.' },
  'lead.meeting.cancelled': { heading: 'Meeting cancelled', intro: 'A lead meeting has been cancelled.' },
  'lead.note': { heading: 'Lead note added', intro: 'A new note was added to a lead.' },
  'task.note': { heading: 'Task note added', intro: 'A new note was added to a task.' },
  'hr.leave.approved': { heading: 'Leave approved', intro: 'Your leave request was approved.' },
  'hr.leave.rejected': { heading: 'Leave rejected', intro: 'Your leave request was rejected.' },
  'hr.advance.approved': { heading: 'Advance approved', intro: 'Your advance request was approved.' },
  'hr.advance.rejected': { heading: 'Advance rejected', intro: 'Your advance request was rejected.' },
  'hr.expense.approved': { heading: 'Reimbursement approved', intro: 'Your reimbursement claim was approved.' },
  'hr.expense.rejected': { heading: 'Reimbursement rejected', intro: 'Your reimbursement claim was rejected.' },
  'hr.attendance.correction.approved': { heading: 'Attendance correction approved', intro: 'Your attendance correction was approved.' },
  'hr.attendance.correction.rejected': { heading: 'Attendance correction rejected', intro: 'Your attendance correction was rejected.' },
  'hr.request.pending': { heading: 'Approval needed', intro: 'An employee request is waiting for your review.' },
  'hr.payroll.processed': { heading: 'Payroll processed', intro: 'Your payroll has been processed.' },
  'hr.payroll.payslip': { heading: 'Salary slip ready', intro: 'Your salary slip is ready to download.' },
  'hr.document.expiring': { heading: 'Document expiring', intro: 'An employee document is nearing expiry.' },
  default: { heading: 'CRM notification', intro: 'You have a new CRM notification.' },
};

function getTransporter() {
  transporter ||= nodemailer.createTransport({ host: env.smtp.host, port: env.smtp.port, secure: env.smtp.secure, connectionTimeout: env.smtp.timeoutMs, greetingTimeout: env.smtp.timeoutMs, socketTimeout: env.smtp.timeoutMs, auth: env.smtp.user && env.smtp.pass ? { user: env.smtp.user, pass: env.smtp.pass } : undefined });
  return transporter;
}

export function isEmailConfigured() {
  return Boolean(testSender || (env.smtp.host && env.smtp.from));
}

export async function emailHealth({ verify = false } = {}) {
  if (!isEmailConfigured()) return { status: 'not_configured', configured: false };
  if (testSender) return { status: 'ok', configured: true, mode: 'test' };
  if (!verify) return { status: 'configured', configured: true, host: env.smtp.host, from: env.smtp.from };
  try { await getTransporter().verify(); return { status: 'ok', configured: true, host: env.smtp.host, from: env.smtp.from }; } catch (error) { return { status: 'degraded', configured: true, host: env.smtp.host, from: env.smtp.from, error: error.code || error.message || 'Email check failed' }; }
}

export function setEmailSenderForTest(sender) {
  testSender = sender;
  transporter = undefined;
}

export function renderNotificationEmail({ title, body, metadata } = {}) {
  const templateKey = metadata?.type || 'default';
  if (templateKey === 'lead.assigned') return leadAssignedEmail(metadata);
  if (templateKey === 'lead.closed') return leadClosedEmail(metadata);
  if (templateKey === 'task.created' || templateKey === 'task.updated') return taskNotificationEmail(metadata);
  const template = EMAIL_TEMPLATES[templateKey] || EMAIL_TEMPLATES.default;
  const from = metadata?.fromName ? `From: ${metadata.fromName}${metadata.fromRole ? ` (${metadata.fromRole})` : ''}` : '';
  const actionUrl = /^https?:\/\/[^\s]+$/i.test(String(metadata?.actionUrl || '')) ? String(metadata.actionUrl) : '';
  const action = actionUrl ? `Review request: ${actionUrl}` : '';
  return { template: templateKey, subject: title || template.heading, text: [template.intro, body, from, action].filter(Boolean).join('\n\n'), html: `<h2>${htmlEscape(template.heading)}</h2><p>${htmlEscape(template.intro)}</p>${body ? `<p><strong>${htmlEscape(body)}</strong></p>` : ''}${from ? `<p>${htmlEscape(from)}</p>` : ''}${actionUrl ? `<p><a href="${htmlEscape(actionUrl)}">Review request</a></p>` : ''}` };
}

export async function sendNotificationEmail({ to, title, body, metadata, attachments }) {
  const message = renderNotificationEmail({ title, body, metadata });
  if (testSender) return testSender({ to, ...message });
  if (!isEmailConfigured()) return { skipped: true };
  return getTransporter().sendMail({ from: env.smtp.from, to, subject: message.subject, text: message.text, html: message.html, attachments });
}
