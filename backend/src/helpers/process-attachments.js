import { trustedAttachment } from '../services/upload.service.js';

const referenceTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
const badRequest = (message) => Object.assign(new Error(message), { statusCode: 400 });

export function referenceAttachments(value) {
  const files = Array.isArray(value) ? value : [];
  if (files.length > 5) throw badRequest('Upload up to five drawing or reference files');
  const attachments = files.map(trustedAttachment);
  if (attachments.some((file) => !file || !referenceTypes.includes(file.contentType))) throw badRequest('Upload valid drawing images, PDF, or Excel files');
  return attachments;
}

export function paymentScreenshot(value) {
  const file = trustedAttachment(value);
  if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.contentType)) throw badRequest('Upload one valid payment screenshot image');
  return file;
}
