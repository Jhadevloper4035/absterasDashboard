import { Router } from 'express';
import { uploadFiles } from '../controllers/upload.controller.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { authenticate, authorizeRoles } from '../modules/auth/middleware/auth.middleware.js';
import { multipartUpload } from '../middleware/upload.middleware.js';

export const uploadRouter = Router();

uploadRouter.use(asyncHandler(authenticate), authorizeRoles('superadmin', 'admin', 'hr-management', 'sales'));
uploadRouter.post('/multipart', multipartUpload, asyncHandler(uploadFiles));
