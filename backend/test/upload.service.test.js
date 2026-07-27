import assert from 'node:assert/strict';
import { test } from 'node:test';
import { detectUploadType, validatePresignRequest } from '../src/services/upload.service.js';

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

test('presign request rejects unsupported extensions', () => {
  assert.throws(
    () => validatePresignRequest({ fileName: 'payload.exe', contentType: 'application/octet-stream', size: 1024 }),
    /Unsupported file type or size/,
  );
});
