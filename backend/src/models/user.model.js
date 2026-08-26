import mongoose from 'mongoose';
import { APP_ACCESS_LEVELS, APP_MODULES } from '../config/app-modules.js';

// Legacy business-role values remain valid for existing records, but new users are role-neutral.
export const USER_ROLES = ['superadmin', 'admin', 'user', 'sales', 'operations', 'accounts', 'designers'];
export const USER_STATUSES = ['active', 'inactive', 'invited', 'suspended'];
export const WORK_PROFILES = ['director', 'employee'];

function isTimezone(value) {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      unique: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    whatsappNumber: {
      type: String,
      trim: true,
    },
    role: {
      type: String,
      enum: USER_ROLES,
      default: 'user',
    },
    additionalRoles: [{
      type: String,
      enum: USER_ROLES,
    }],
    accessTypes: [{
      type: String,
      trim: true,
      lowercase: true,
    }],
    workProfile: {
      type: String,
      enum: WORK_PROFILES,
    },
    modulePermissions: [{
      module: { type: String, enum: APP_MODULES, required: true },
      access: { type: String, enum: APP_ACCESS_LEVELS, default: 'none' },
    }],
    status: {
      type: String,
      enum: USER_STATUSES,
      default: 'active',
    },
    failedLoginAttempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    loginLockedAt: Date,
    manager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    teams: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Team',
      },
    ],
    territories: [
      {
        type: String,
        trim: true,
      },
    ],
    timezone: {
      type: String,
      default: 'UTC',
      validate: {
        validator: isTimezone,
        message: 'Invalid timezone',
      },
    },
    notificationPreferences: {
      inApp: {
        type: Boolean,
        default: true,
      },
      whatsapp: {
        type: Boolean,
        default: false,
      },
      morningSummary: {
        enabled: {
          type: Boolean,
          default: false,
        },
        time: {
          type: String,
          default: '08:00',
          match: /^([01]\d|2[0-3]):[0-5]\d$/,
        },
      },
    },
    lastLoginAt: Date,
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.passwordHash;
        return ret;
      },
    },
  },
);

userSchema.index({ role: 1, status: 1, createdAt: -1 });
userSchema.index({ additionalRoles: 1, status: 1, createdAt: -1 });
userSchema.index({ status: 1, createdAt: -1 });

export const User = mongoose.model('User', userSchema);
