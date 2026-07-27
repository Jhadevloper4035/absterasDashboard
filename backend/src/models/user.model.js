import mongoose from 'mongoose';

export const USER_ROLES = ['superadmin', 'admin', 'sales'];
export const USER_STATUSES = ['active', 'inactive', 'invited', 'suspended'];

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
      trim: true,
    },
    whatsappNumber: {
      type: String,
      trim: true,
    },
    role: {
      type: String,
      enum: USER_ROLES,
      default: 'sales',
    },
    status: {
      type: String,
      enum: USER_STATUSES,
      default: 'active',
    },
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

export const User = mongoose.model('User', userSchema);
