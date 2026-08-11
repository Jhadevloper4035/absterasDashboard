import mongoose from 'mongoose';

export const ATTENDANCE_STATUSES = ['present', 'absent', 'half-day', 'late', 'leave'];

const attendanceSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    date: { type: Date, required: true },
    checkIn: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    checkOut: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    status: { type: String, enum: ATTENDANCE_STATUSES, required: true },
    isRegularized: { type: Boolean, default: false },
    regularizationReason: { type: String, trim: true },
    workMinutes: { type: Number, min: 0, default: 0 },
    isShortLeave: { type: Boolean, default: false },
    overtimeMinutes: { type: Number, min: 0, default: 0 },
    correctionRequest: {
      status: { type: String, enum: ['pending', 'approved', 'rejected'] },
      reason: { type: String, trim: true },
      requestedStatus: { type: String, enum: ATTENDANCE_STATUSES },
      requestedCheckIn: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
      requestedCheckOut: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
      requestedAt: Date,
      decidedAt: Date,
      decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });

export const Attendance = mongoose.models.Attendance || mongoose.model('Attendance', attendanceSchema);
