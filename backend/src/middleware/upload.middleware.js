import multer from 'multer';
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_FILES } from '../services/upload.service.js';

function reject(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export const multipartUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_BYTES,
    files: MAX_UPLOAD_FILES,
    fields: 5,
    parts: MAX_UPLOAD_FILES + 5,
  },
  fileFilter(req, file, cb) {
    if (file.fieldname !== 'files') {
      return cb(reject(400, 'Upload field must be files'));
    }

    return cb(null, true);
  },
}).array('files', MAX_UPLOAD_FILES);
