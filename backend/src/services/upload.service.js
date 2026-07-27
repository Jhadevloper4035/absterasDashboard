import { randomUUID, createHash } from 'node:crypto';
import path from 'node:path';
import { TextDecoder } from 'node:util';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import sharp from 'sharp';
import { env } from '../config/env.js';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_UPLOAD_FILES = 5;

const textDecoder = new TextDecoder('utf-8', { fatal: true });
const s3Client = new S3Client({
  region: env.s3.region,
  ...(env.s3.endpoint ? { endpoint: env.s3.endpoint, forcePathStyle: env.s3.forcePathStyle } : {}),
});

const TYPES = [
  {
    key: 'jpeg',
    kind: 'image',
    extensions: ['.jpg', '.jpeg'],
    mimes: ['image/jpeg'],
    contentType: 'image/jpeg',
    outputExtension: 'jpg',
    matches: (buffer) => buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
  },
  {
    key: 'png',
    kind: 'image',
    extensions: ['.png'],
    mimes: ['image/png'],
    contentType: 'image/png',
    outputExtension: 'png',
    matches: (buffer) => buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    key: 'webp',
    kind: 'image',
    extensions: ['.webp'],
    mimes: ['image/webp'],
    contentType: 'image/webp',
    outputExtension: 'webp',
    matches: (buffer) => buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP',
  },
  {
    key: 'pdf',
    kind: 'document',
    extensions: ['.pdf'],
    mimes: ['application/pdf'],
    contentType: 'application/pdf',
    outputExtension: 'pdf',
    matches: (buffer) => buffer.subarray(0, 5).toString('ascii') === '%PDF-',
  },
  {
    key: 'csv',
    kind: 'text',
    extensions: ['.csv'],
    mimes: ['text/csv', 'application/csv', 'application/vnd.ms-excel'],
    contentType: 'text/csv',
    outputExtension: 'csv',
    matches: isSafeText,
  },
  {
    key: 'text',
    kind: 'text',
    extensions: ['.txt'],
    mimes: ['text/plain'],
    contentType: 'text/plain',
    outputExtension: 'txt',
    matches: isSafeText,
  },
];

function uploadError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function isSafeText(buffer) {
  if (buffer.includes(0)) return false;
  try {
    const text = textDecoder.decode(buffer);
    return !/(<script|<html|<\?php|javascript:|^#!)/im.test(text);
  } catch {
    return false;
  }
}

function cleanMetadata(value) {
  return String(value || '')
    .replace(/[^\w .@-]/g, '')
    .slice(0, 120);
}

function monthPath() {
  return new Date().toISOString().slice(0, 7);
}

function assertS3Configured() {
  if (!env.s3.bucket) {
    throw uploadError(503, 'S3 upload is not configured');
  }
}

export function detectUploadType({ originalname, mimetype, buffer, size = buffer?.length || 0 }) {
  if (!buffer?.length || size > MAX_UPLOAD_BYTES) return null;

  const extension = path.extname(originalname || '').toLowerCase();
  const mime = String(mimetype || '').toLowerCase();
  const type = TYPES.find((item) => item.extensions.includes(extension) && item.mimes.includes(mime));

  if (!type || !type.matches(buffer)) return null;
  return type;
}

export function validatePresignRequest({ fileName, contentType, size }) {
  const extension = path.extname(fileName || '').toLowerCase();
  const type = TYPES.find((item) => item.extensions.includes(extension) && item.mimes.includes(String(contentType || '').toLowerCase()));
  const bytes = Number(size);

  if (!type || !Number.isFinite(bytes) || bytes <= 0 || bytes > MAX_UPLOAD_BYTES) {
    throw uploadError(400, 'Unsupported file type or size');
  }

  return type;
}

async function compressIfImage(file, type) {
  if (type.key === 'jpeg') {
    return sharp(file.buffer, { limitInputPixels: 40_000_000 }).rotate().resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  }

  if (type.key === 'png') {
    return sharp(file.buffer, { limitInputPixels: 40_000_000 }).rotate().resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true }).png({ compressionLevel: 9, palette: true }).toBuffer();
  }

  if (type.key === 'webp') {
    return sharp(file.buffer, { limitInputPixels: 40_000_000 }).rotate().resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82, effort: 4 }).toBuffer();
  }

  return file.buffer;
}

export async function uploadMultipartFiles(files, user) {
  assertS3Configured();

  if (!files?.length) {
    throw uploadError(400, 'At least one file is required');
  }

  return Promise.all(
    files.map(async (file) => {
      const type = detectUploadType(file);
      if (!type) {
        throw uploadError(400, `Unsupported or suspicious file: ${file.originalname}`);
      }

      const body = await compressIfImage(file, type);
      if (body.length > MAX_UPLOAD_BYTES) {
        throw uploadError(400, `File is too large after processing: ${file.originalname}`);
      }

      const checksum = createHash('sha256').update(body).digest('hex');
      const key = `${env.s3.uploadPrefix}/${type.kind}/${monthPath()}/${randomUUID()}.${type.outputExtension}`;

      await s3Client.send(
        new PutObjectCommand({
          Bucket: env.s3.bucket,
          Key: key,
          Body: body,
          ContentLength: body.length,
          ContentType: type.contentType,
          Metadata: {
            checksum,
            originalName: cleanMetadata(file.originalname),
            uploadedBy: String(user._id),
          },
          ServerSideEncryption: 'AES256',
        }),
      );

      const url = await getSignedUrl(s3Client, new GetObjectCommand({ Bucket: env.s3.bucket, Key: key }), { expiresIn: 900 });

      return {
        key,
        url,
        contentType: type.contentType,
        originalName: file.originalname,
        size: body.length,
        compressed: body.length < file.size,
        checksum,
      };
    }),
  );
}

export async function createPresignedUpload(body, user) {
  assertS3Configured();

  const type = validatePresignRequest(body);
  const key = `${env.s3.uploadPrefix}/pending/${String(user._id)}/${randomUUID()}.${type.outputExtension}`;
  const command = new PutObjectCommand({
    Bucket: env.s3.bucket,
    Key: key,
    ContentType: type.contentType,
    Metadata: {
      originalName: cleanMetadata(body.fileName),
      uploadedBy: String(user._id),
      validation: 'pending',
    },
    ServerSideEncryption: 'AES256',
  });

  const url = await getSignedUrl(s3Client, command, {
    expiresIn: 300,
    signableHeaders: new Set(['content-type']),
  });

  return {
    key,
    url,
    method: 'PUT',
    expiresIn: 300,
    headers: { 'content-type': type.contentType },
    note: 'Presigned uploads are stored under pending/ and must be validated before use.',
  };
}
