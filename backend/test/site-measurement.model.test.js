import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SiteMeasurement } from '../src/modules/designer/models/site-measurement.model.js';

test('SiteMeasurement accepts multiple entries for one client address', async () => {
  const values = { client: '507f1f77bcf86cd799439011', clientSite: '507f1f77bcf86cd799439012', attachment: { key: 'uploads/document/measurement.pdf' }, createdBy: '507f1f77bcf86cd799439013' };
  const first = new SiteMeasurement({ ...values, title: 'First site visit' });
  const second = new SiteMeasurement({ ...values, title: 'Second site visit' });
  await Promise.all([first.validate(), second.validate()]);
  assert.equal(second.clientSite.toString(), first.clientSite.toString());
  assert.equal(second.title, 'Second site visit');
});
