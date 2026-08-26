import { Router } from 'express';
import { addTaskNote, createTask, createTaskWorkType, deleteTask, deleteTaskWorkType, getTask, listTaskAssignees, listTaskWorkTypes, listTasks, updateTask } from './controllers/task.controller.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { authenticate, authorizeAppModule } from '../auth/middleware/auth.middleware.js';

export const taskRouter = Router();
taskRouter.use(asyncHandler(authenticate), authorizeAppModule('tasks'));
taskRouter.get('/', asyncHandler(listTasks));
taskRouter.get('/assignees', asyncHandler(listTaskAssignees));
taskRouter.get('/work-types', asyncHandler(listTaskWorkTypes));
taskRouter.post('/work-types', authorizeAppModule('tasks', 'manage'), asyncHandler(createTaskWorkType));
taskRouter.delete('/work-types/:role/:name', authorizeAppModule('tasks', 'manage'), asyncHandler(deleteTaskWorkType));
taskRouter.post('/', authorizeAppModule('tasks', 'manage'), asyncHandler(createTask));
taskRouter.get('/:id', asyncHandler(getTask));
taskRouter.patch('/:id', authorizeAppModule('tasks', 'manage'), asyncHandler(updateTask));
taskRouter.post('/:id/notes', authorizeAppModule('tasks', 'manage'), asyncHandler(addTaskNote));
taskRouter.delete('/:id', authorizeAppModule('tasks', 'manage'), asyncHandler(deleteTask));
