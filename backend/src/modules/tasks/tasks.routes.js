import { Router } from 'express';
import { addTaskNote, createTask, createTaskWorkType, deleteTask, deleteTaskWorkType, getTask, listTaskAssignees, listTaskWorkTypes, listTasks, updateTask } from './controllers/task.controller.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { authenticate, authorizeRoles } from '../auth/middleware/auth.middleware.js';
import { USER_ROLES } from '../../models/user.model.js';

export const taskRouter = Router();
taskRouter.use(asyncHandler(authenticate), authorizeRoles(...USER_ROLES));
taskRouter.get('/', asyncHandler(listTasks));
taskRouter.get('/assignees', asyncHandler(listTaskAssignees));
taskRouter.get('/work-types', asyncHandler(listTaskWorkTypes));
taskRouter.post('/work-types', asyncHandler(createTaskWorkType));
taskRouter.delete('/work-types/:role/:name', asyncHandler(deleteTaskWorkType));
taskRouter.post('/', asyncHandler(createTask));
taskRouter.get('/:id', asyncHandler(getTask));
taskRouter.patch('/:id', asyncHandler(updateTask));
taskRouter.post('/:id/notes', asyncHandler(addTaskNote));
taskRouter.delete('/:id', asyncHandler(deleteTask));
