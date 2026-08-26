import mongoose from 'mongoose';
export const DEFAULT_TASK_WORK_TYPES = {
  general: ['Coating', 'Procurement', 'Laser Cut', 'Drawing', '3D Design', 'Revision', 'Follow Up', 'Meeting', 'Quotation', 'Documentation', 'Approval', 'Coordination', 'Payment Reminder', 'Salary Slip', 'Ledger Update'],
};

export const TASK_WORK_TYPE_ROLES = ['general'];

export function normalizeTaskWorkType(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

const taskWorkTypeSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: TASK_WORK_TYPE_ROLES,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60,
    },
    normalizedName: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    deleted: {
      type: Boolean,
      default: false,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true },
);

taskWorkTypeSchema.index({ role: 1, normalizedName: 1 }, { unique: true });

export const TaskWorkType = mongoose.model('TaskWorkType', taskWorkTypeSchema);
