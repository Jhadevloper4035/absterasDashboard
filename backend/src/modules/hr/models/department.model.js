import mongoose from 'mongoose';

const departmentSchema = new mongoose.Schema({ name: { type: String, required: true, trim: true, unique: true }, description: { type: String, trim: true } }, { timestamps: true });

export const Department = mongoose.models.Department || mongoose.model('Department', departmentSchema);
