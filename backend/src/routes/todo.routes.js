import { Router } from 'express';
import {
  createTodo,
  deleteTodo,
  listTodoAssignees,
  listTodos,
  updateTodo,
} from '../controllers/todo.controller.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware.js';
import { USER_ROLES } from '../models/user.model.js';

export const todoRouter = Router();

todoRouter.use(asyncHandler(authenticate), authorizeRoles(...USER_ROLES));
todoRouter.get('/', asyncHandler(listTodos));
todoRouter.get('/assignees', asyncHandler(listTodoAssignees));
todoRouter.post('/', asyncHandler(createTodo));
todoRouter.patch('/:id', asyncHandler(updateTodo));
todoRouter.delete('/:id', asyncHandler(deleteTodo));
