import mongoose from 'mongoose';

const blockedTokenSchema = new mongoose.Schema(
  {
    jti: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
  },
  { timestamps: true },
);

export const BlockedToken = mongoose.models.BlockedToken || mongoose.model('BlockedToken', blockedTokenSchema);
