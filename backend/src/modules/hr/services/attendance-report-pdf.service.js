import { renderPdf } from '../../../services/pdf.service.js';

const escape = (value) => String(value ?? '-').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
const date = (value) => new Date(value).toLocaleDateString('en-CA', { timeZone: 'UTC' });
const hours = (minutes = 0) => `${Math.floor(minutes / 60)}h ${minutes % 60}m`;

export function attendanceReportHtml({ employee, records, from, to }) {
  const rows = records.map((record) => `<tr><td>${date(record.date)}</td><td>${escape(record.status)}</td><td>${escape(record.checkIn)}</td><td>${escape(record.checkOut)}</td><td>${hours(record.workMinutes)}</td><td>${Number(record.overtimeMinutes || 0)} min</td></tr>`).join('') || '<tr><td colspan="6">No attendance records for this period.</td></tr>';
  return `<!doctype html><html><head><style>@page{size:A4;margin:15mm}body{font:11px Arial;color:#111}h1{margin:0 0 5px}.muted{color:#555;margin-bottom:18px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #bbb;padding:7px;text-align:left}th{background:#f0f0f0}</style></head><body><h1>Attendance report</h1><div class="muted"><b>${escape(employee.user?.name)}</b> · ${escape(employee.department?.name || 'No department')}<br>Period: ${date(from)} – ${date(to)}</div><table><thead><tr><th>Date</th><th>Status</th><th>Punch in</th><th>Punch out</th><th>Hours</th><th>Overtime</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
}

export const createAttendanceReportPdf = (data) => renderPdf(attendanceReportHtml(data));
