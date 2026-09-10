import { Router } from 'express';
import { createChallan, deleteChallan, downloadChallanPdf, downloadProcessChallanPdf, getChallan, listChallans, updateChallan } from './controllers/challan.controller.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { authenticate, authorizeAppModule } from '../auth/middleware/auth.middleware.js';

export const challanRouter = Router();
challanRouter.use(asyncHandler(authenticate), authorizeAppModule('challans'));
challanRouter.get('/', asyncHandler(listChallans));
challanRouter.post('/', authorizeAppModule('challans', 'manage'), asyncHandler(createChallan));
challanRouter.get('/:process/:id/pdf', asyncHandler(downloadProcessChallanPdf));
challanRouter.get('/:id/pdf', asyncHandler(downloadChallanPdf));
challanRouter.get('/:id', asyncHandler(getChallan));
challanRouter.patch('/:id', authorizeAppModule('challans', 'manage'), asyncHandler(updateChallan));
challanRouter.delete('/:id', authorizeAppModule('challans', 'manage'), asyncHandler(deleteChallan));
