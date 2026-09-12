import assert from 'node:assert/strict';
import { test } from 'node:test';
import { detectUploadType } from '../src/services/upload.service.js';

test('Upload validation accepts a structurally identifiable XLSX workbook', () => {
  const buffer = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('[Content_Types].xml xl/workbook.xml')]);
  const type = detectUploadType({ originalname: 'production.xlsx', mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer });
  assert.equal(type?.key, 'xlsx');
});
