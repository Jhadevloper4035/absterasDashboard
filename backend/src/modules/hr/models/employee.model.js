import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema({
  type: { type: String, required: true, trim: true },
  key: { type: String, required: true },
  contentType: String,
  originalName: String,
  size: Number,
  checksum: String,
  expiresAt: Date,
  uploadedAt: { type: Date, default: Date.now },
}, { _id: false });

const employeeSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    employeeType: { type: String, enum: ['office', 'site'], required: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
    designation: { type: mongoose.Schema.Types.ObjectId, ref: 'Designation', required: true },
    manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    joiningDate: { type: Date, required: true },
    status: { type: String, enum: ['active', 'resigned', 'terminated'], default: 'active' },
    lastWorkingDate: Date,
    photo: documentSchema,
    documents: [documentSchema],
    emergencyContact: { name: { type: String, trim: true }, phone: { type: String, trim: true }, relation: { type: String, trim: true } },
  },
  { timestamps: true },
);

employeeSchema.index({ status: 1, createdAt: -1 });

export const Employee = mongoose.models.Employee || mongoose.model('Employee', employeeSchema);
