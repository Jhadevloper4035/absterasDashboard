import assert from 'node:assert/strict';
import { test } from 'node:test';
import { idCardHtml } from '../src/modules/hr/services/id-card-pdf.service.js';

test('ID card template embeds employee details and CSS', () => {
  const html = idCardHtml({ _id: 'employee12345678', user: { name: 'Ava <Smith>', email: 'ava@example.com', phone: '+971500000000' }, department: { name: 'Design' }, designation: { name: 'Designer' } });
  assert.match(html, /Ava &lt;Smith&gt;/);
  assert.match(html, /employee-id-card/);
  assert.match(html, /84\.667mm 125mm/);
});
