import assert from 'node:assert/strict';
import { DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { test } from 'node:test';
import { env } from '../src/config/env.js';
import { createAttachmentToken, deleteUploadedAttachment, setS3ClientForTest } from '../src/services/upload.service.js';

test('deleting an uploaded attachment deletes only the uploader S3 object', async () => {
  const originalBucket = env.s3.bucket;
  const calls = [];
  const attachment = { key: 'uploads/document/test.pdf', checksum: 'checksum' };
  attachment.attachmentToken = createAttachmentToken(attachment);
  env.s3.bucket = 'test-bucket';
  const originalClient = setS3ClientForTest({ send: async (command) => {
    calls.push(command);
    return command instanceof HeadObjectCommand ? { Metadata: { uploadedby: 'user-1' } } : {};
  } });

  try {
    await deleteUploadedAttachment(attachment, { _id: 'user-1' });
    assert.ok(calls[0] instanceof HeadObjectCommand);
    assert.ok(calls[1] instanceof DeleteObjectCommand);
  } finally {
    env.s3.bucket = originalBucket;
    setS3ClientForTest(originalClient);
  }
});
