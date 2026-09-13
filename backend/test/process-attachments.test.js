import assert from 'node:assert/strict';
import test from 'node:test';
import { paymentScreenshot, referenceAttachments } from '../src/helpers/process-attachments.js';

test('process attachments reject untrusted, excessive, and non-image payment files', () => {
  assert.throws(() => referenceAttachments(new Array(6)), /up to five/i);
  assert.throws(() => referenceAttachments([{}]), /valid drawing/i);
  assert.throws(() => paymentScreenshot({}), /valid payment screenshot/i);
});
