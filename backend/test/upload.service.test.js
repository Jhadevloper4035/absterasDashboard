import assert from 'node:assert/strict';
import { test } from 'node:test';
import { detectUploadType } from '../src/services/upload.service.js';

test('upload type detection rejects mismatched file content', () => {
  const type = detectUploadType({
    originalname: 'invoice.pdf',
    mimetype: 'application/pdf',
    buffer: Buffer.from('MZ suspicious executable'),
    size: 22,
  });

  assert.equal(type, null);
});

test('upload type detection accepts matching PDF magic bytes', () => {
  const type = detectUploadType({
    originalname: 'invoice.pdf',
    mimetype: 'application/pdf',
    buffer: Buffer.from('%PDF-1.7\n'),
    size: 9,
  });

  assert.equal(type.key, 'pdf');
});

test('upload type detection rejects Office documents until malware scanning exists', () => {
  const ole = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00]);
  const zip = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00]);

  assert.equal(detectUploadType({ originalname: 'brief.doc', mimetype: 'application/msword', buffer: ole, size: ole.length }), null);
  assert.equal(
    detectUploadType({
      originalname: 'brief.docx',
      mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer: zip,
      size: zip.length,
    }),
    null,
  );
  assert.equal(detectUploadType({ originalname: 'plan.xls', mimetype: 'application/vnd.ms-excel', buffer: ole, size: ole.length }), null);
  assert.equal(
    detectUploadType({
      originalname: 'plan.xlsx',
      mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: zip,
      size: zip.length,
    }),
    null,
  );
});
