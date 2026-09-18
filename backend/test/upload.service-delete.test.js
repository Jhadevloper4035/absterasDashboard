import assert from 'node:assert/strict';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { test } from 'node:test';
import { env } from '../src/config/env.js';
import { createAttachmentToken, deleteUploadedAttachment, setS3ClientForTest } from '../src/services/upload.service.js';

test('deleting a trusted attachment removes its S3 object', async () => {
  const originalBucket = env.s3.bucket;
  const calls = [];
  const attachment = { key: 'uploads/document/test.pdf', checksum: 'checksum' };
  attachment.attachmentToken = createAttachmentToken(attachment);
  env.s3.bucket = 'test-bucket';
  const originalClient = setS3ClientForTest({ send: async (command) => {
    calls.push(command);
    return {};
  } });

  try {
    await deleteUploadedAttachment(attachment);
    assert.equal(calls.length, 1);
    assert.ok(calls[0] instanceof DeleteObjectCommand);
  } finally {
    env.s3.bucket = originalBucket;
    setS3ClientForTest(originalClient);
  }
});

test('deleting an attachment reports missing S3 delete permission', async () => {
  const originalBucket = env.s3.bucket;
  const attachment = { key: 'uploads/document/test.pdf', checksum: 'checksum' };
  attachment.attachmentToken = createAttachmentToken(attachment);
  env.s3.bucket = 'test-bucket';
  const originalClient = setS3ClientForTest({ send: async () => {
    const error = new Error('Access denied');
    error.name = 'AccessDenied';
    throw error;
  } });

  try {
    await assert.rejects(deleteUploadedAttachment(attachment), (error) => error.statusCode === 503 && error.message === 'S3 delete permission is not configured');
  } finally {
    env.s3.bucket = originalBucket;
    setS3ClientForTest(originalClient);
  }
});
