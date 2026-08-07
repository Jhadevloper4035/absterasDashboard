import mongoose from 'mongoose';

const designationSchema = new mongoose.Schema({ name: { type: String, required: true, trim: true, unique: true }, department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' }, description: { type: String, trim: true } }, { timestamps: true });

export const Designation = mongoose.models.Designation || mongoose.model('Designation', designationSchema);
