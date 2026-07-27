import { Router } from 'express';
import {
  createTodo,
  deleteTodo,
  listTodos,
  updateTodo,
} from '../controllers/todo.controller.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware.js';

export const todoRouter = Router();

todoRouter.use(asyncHandler(authenticate), authorizeRoles('superadmin', 'admin', 'sales'));
todoRouter.get('/', asyncHandler(listTodos));
todoRouter.post('/', asyncHandler(createTodo));
todoRouter.patch('/:id', asyncHandler(updateTodo));
todoRouter.delete('/:id', asyncHandler(deleteTodo));
