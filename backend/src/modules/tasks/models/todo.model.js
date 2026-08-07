import mongoose from 'mongoose';

export const TODO_STATUSES = ['Pending', 'In-Progress', 'Completed'];
export const TODO_PRIORITIES = ['Low', 'Medium', 'High'];

const todoSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    dueDate: Date,
    status: {
      type: String,
      enum: TODO_STATUSES,
      default: 'Pending',
    },
    priority: {
      type: String,
      enum: TODO_PRIORITIES,
      default: 'Medium',
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    completedAt: Date,
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true },
);

todoSchema.index({ assignedTo: 1, status: 1, dueDate: 1, createdAt: -1 });
todoSchema.index({ status: 1, dueDate: 1, createdAt: -1 });

export const Todo = mongoose.model('Todo', todoSchema);
