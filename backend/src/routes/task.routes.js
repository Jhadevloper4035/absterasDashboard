import { Router } from 'express';
import {
  addTaskNote,
  createTask,
  deleteTask,
  getTask,
  listTaskAssignees,
  listTasks,
  updateTask,
} from '../controllers/task.controller.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware.js';

export const taskRouter = Router();

taskRouter.use(asyncHandler(authenticate), authorizeRoles('superadmin', 'admin', 'sales'));
taskRouter.get('/', asyncHandler(listTasks));
taskRouter.get('/assignees', asyncHandler(listTaskAssignees));
taskRouter.post('/', asyncHandler(createTask));
taskRouter.get('/:id', asyncHandler(getTask));
taskRouter.patch('/:id', asyncHandler(updateTask));
taskRouter.post('/:id/notes', asyncHandler(addTaskNote));
taskRouter.delete('/:id', asyncHandler(deleteTask));
