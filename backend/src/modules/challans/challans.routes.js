import { Router } from 'express';
import { createChallan, deleteChallan, downloadChallanPdf, downloadProcessChallanPdf, getChallan, listChallans, updateChallan, updateTransportationPayment } from './controllers/challan.controller.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { authenticate, authorizeAppModule } from '../auth/middleware/auth.middleware.js';
import { multipartUpload } from '../../middleware/upload.middleware.js';
import { uploadFiles } from '../../controllers/upload.controller.js';
import { rateLimit } from '../../middleware/rate-limit.middleware.js';

export const challanRouter = Router();
challanRouter.use(asyncHandler(authenticate), authorizeAppModule('challans'));
challanRouter.get('/', asyncHandler(listChallans));
challanRouter.post('/', authorizeAppModule('challans', 'manage'), asyncHandler(createChallan));
challanRouter.post('/uploads', authorizeAppModule('challans', 'manage'), asyncHandler(rateLimit({ scope: 'challan-upload', limit: 10, windowMs: 15 * 60 * 1000 })), multipartUpload, asyncHandler(uploadFiles));
challanRouter.get('/:process/:id/pdf', asyncHandler(downloadProcessChallanPdf));
challanRouter.get('/:id/pdf', asyncHandler(downloadChallanPdf));
challanRouter.get('/:id', asyncHandler(getChallan));
challanRouter.patch('/:id/transportation-payment', authorizeAppModule('challans', 'manage'), asyncHandler(updateTransportationPayment));
challanRouter.patch('/:id', authorizeAppModule('challans', 'manage'), asyncHandler(updateChallan));
challanRouter.delete('/:id', authorizeAppModule('challans', 'manage'), asyncHandler(deleteChallan));
