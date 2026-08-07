import mongoose from 'mongoose';

export const HR_MODULES = ['employees', 'attendance', 'leave', 'payroll', 'expenses', 'reports'];
export const HR_ACCESS_LEVELS = ['none', 'view', 'manage'];

const hrPermissionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    module: { type: String, enum: HR_MODULES, required: true },
    access: { type: String, enum: HR_ACCESS_LEVELS, default: 'none' },
    grantedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

hrPermissionSchema.index({ user: 1, module: 1 }, { unique: true });

export const HrPermission = mongoose.models.HrPermission || mongoose.model('HrPermission', hrPermissionSchema);
