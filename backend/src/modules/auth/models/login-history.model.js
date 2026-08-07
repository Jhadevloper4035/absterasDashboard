import mongoose from 'mongoose';

const loginHistorySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    role: {
      type: String,
      required: true,
      index: true,
    },
    ipAddress: String,
    userAgent: String,
    loggedInAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    logoutAt: Date,
    logoutReason: {
      type: String,
      enum: ['logout', 'new_login'],
    },
  },
  { timestamps: true },
);

loginHistorySchema.index({ user: 1, loggedInAt: -1 });
loginHistorySchema.index({ role: 1, loggedInAt: -1 });
loginHistorySchema.index({ logoutAt: 1, loggedInAt: -1 });

export const LoginHistory = mongoose.models.LoginHistory || mongoose.model('LoginHistory', loginHistorySchema);
