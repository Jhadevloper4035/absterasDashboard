import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ProductionData } from '../src/modules/designer/models/production-data.model.js';

test('ProductionData has one record per client address', async () => {
  const productionData = new ProductionData({ client: '507f1f77bcf86cd799439011', clientSite: '507f1f77bcf86cd799439012', title: 'Tower A production pack', sourceDocuments: { boq: { key: 'uploads/document/boq.pdf' }, drawing: { key: 'uploads/document/drawing.pdf' }, siteMeasurement: { key: 'uploads/document/measurement.pdf' } }, attachments: [{ key: 'uploads/document/production.pdf' }, { key: 'uploads/document/production.xlsx' }], createdBy: '507f1f77bcf86cd799439013' });
  await productionData.validate();
  assert.equal(productionData.attachments.length, 2);
  const [, options] = ProductionData.schema.indexes().find(([index]) => index.client && index.clientSite);
  assert.equal(options.unique, true);
});
