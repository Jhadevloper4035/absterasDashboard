import { Router } from 'express';
import { createInvoice, downloadInvoicePdf, getInvoice, listInvoices, updateInvoice } from './controllers/invoice.controller.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { authenticate, authorizeAppModule } from '../auth/middleware/auth.middleware.js';

export const invoiceRouter = Router();
invoiceRouter.use(asyncHandler(authenticate), authorizeAppModule('clients'));
invoiceRouter.get('/', asyncHandler(listInvoices));
invoiceRouter.post('/', authorizeAppModule('clients', 'manage'), asyncHandler(createInvoice));
invoiceRouter.get('/:id/pdf', asyncHandler(downloadInvoicePdf));
invoiceRouter.get('/:id', asyncHandler(getInvoice));
invoiceRouter.patch('/:id', authorizeAppModule('clients', 'manage'), asyncHandler(updateInvoice));
