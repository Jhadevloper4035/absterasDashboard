import mongoose from 'mongoose';

const rateLimitSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    count: {
      type: Number,
      default: 0,
    },
    windowExpiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
  },
  { timestamps: true },
);

export const RateLimit = mongoose.models.RateLimit || mongoose.model('RateLimit', rateLimitSchema);
