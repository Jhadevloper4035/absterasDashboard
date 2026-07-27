import { Router } from 'express';
import { presignUpload, uploadFiles } from '../controllers/upload.controller.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware.js';
import { multipartUpload } from '../middleware/upload.middleware.js';

export const uploadRouter = Router();

uploadRouter.use(asyncHandler(authenticate), authorizeRoles('superadmin', 'admin', 'sales'));
uploadRouter.post('/multipart', multipartUpload, asyncHandler(uploadFiles));
uploadRouter.post('/presign', asyncHandler(presignUpload));
