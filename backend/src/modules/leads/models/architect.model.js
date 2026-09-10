import mongoose from 'mongoose';

const architectSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      index: true,
    },
    company: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    specialty: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true },
);

architectSchema.index({ owner: 1, createdAt: -1 });

export const Architect = mongoose.model('Architect', architectSchema);
