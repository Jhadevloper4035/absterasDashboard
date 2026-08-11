import assert from 'node:assert/strict';
import { test } from 'node:test';
import { attendanceReportHtml } from '../src/modules/hr/services/attendance-report-pdf.service.js';

test('attendance report escapes employee details and renders attendance', () => {
  const html = attendanceReportHtml({ employee: { user: { name: 'Ava <Smith>' }, department: { name: 'Design' } }, records: [{ date: '2026-08-10T00:00:00.000Z', status: 'present', checkIn: '09:00', checkOut: '18:00', workMinutes: 540, overtimeMinutes: 0 }], from: '2026-08-01', to: '2026-08-31' });
  assert.match(html, /Ava &lt;Smith&gt;/);
  assert.match(html, /9h 0m/);
});
