import mongoose from 'mongoose';

const authSessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    accessTokenJti: {
      type: String,
      required: true,
      index: true,
    },
    userAgent: String,
    ipAddress: String,
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
    revokedAt: Date,
    replacedBy: String,
  },
  { timestamps: true },
);

authSessionSchema.index({ user: 1, revokedAt: 1, expiresAt: 1, createdAt: -1 });
authSessionSchema.index({ revokedAt: 1, expiresAt: 1, createdAt: -1 });

export const AuthSession = mongoose.models.AuthSession || mongoose.model('AuthSession', authSessionSchema);
