import { Router } from 'express';
import { createTodo, deleteTodo, listTodoAssignees, listTodos, updateTodo } from './controllers/todo.controller.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { authenticate, authorizeAppModule } from '../auth/middleware/auth.middleware.js';

export const todoRouter = Router();
todoRouter.use(asyncHandler(authenticate), authorizeAppModule('todo'));
todoRouter.get('/', asyncHandler(listTodos));
todoRouter.get('/assignees', asyncHandler(listTodoAssignees));
todoRouter.post('/', authorizeAppModule('todo', 'manage'), asyncHandler(createTodo));
todoRouter.patch('/:id', authorizeAppModule('todo', 'manage'), asyncHandler(updateTodo));
todoRouter.delete('/:id', authorizeAppModule('todo', 'manage'), asyncHandler(deleteTodo));
