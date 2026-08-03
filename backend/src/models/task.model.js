import { randomInt } from 'node:crypto';
import mongoose from 'mongoose';

export const TASK_PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];
export const TASK_STATUSES = ['Backlog', 'To Do', 'In Progress', 'Review', 'Testing', 'Blocked', 'Done'];

const attachmentSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    contentType: String,
    originalName: String,
    size: Number,
    checksum: String,
  },
  { _id: false },
);

const noteSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    attachments: [attachmentSchema],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true },
);

const taskSchema = new mongoose.Schema(
  {
    ticketNumber: {
      type: String,
      trim: true,
      uppercase: true,
      unique: true,
      sparse: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: { type: String, trim: true },
    acceptanceCriteria: { type: String, trim: true },
    assignee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    priority: {
      type: String,
      enum: TASK_PRIORITIES,
      default: 'Medium',
    },
    status: {
      type: String,
      enum: TASK_STATUSES,
      default: 'To Do',
    },
    dueDate: Date,
    projectEpic: { type: String, trim: true },
    labels: [{ type: String, trim: true }],
    dependenciesBlockers: { type: String, trim: true },
    technicalNotes: { type: String, trim: true },
    attachments: [attachmentSchema],
    notes: [noteSchema],
    definitionOfDone: { type: String, trim: true },
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

taskSchema.pre('validate', async function assignTicketNumber() {
  if (!this.isNew || this.ticketNumber) return;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const ticketNumber = `T-${randomInt(100000, 1000000)}`;
    if (!(await this.constructor.exists({ ticketNumber }))) {
      this.ticketNumber = ticketNumber;
      return;
    }
  }
});

taskSchema.index({ assignee: 1, status: 1, dueDate: 1, createdAt: -1 });
taskSchema.index({ status: 1, dueDate: 1, createdAt: -1 });
taskSchema.index({ projectEpic: 1, dueDate: 1 });
taskSchema.index({ priority: 1, dueDate: 1 });
taskSchema.index({ createdAt: -1 });

export const Task = mongoose.model('Task', taskSchema);
