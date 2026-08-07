import mongoose from 'mongoose';

const allowanceSchema = new mongoose.Schema({ name: { type: String, required: true, trim: true }, amount: { type: Number, min: 0, required: true } }, { _id: false });
const salaryStructureSchema = new mongoose.Schema({ employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true }, ctc: { type: Number, min: 0, required: true }, basic: { type: Number, min: 0, required: true }, hra: { type: Number, min: 0, default: 0 }, allowances: [allowanceSchema], effectiveFrom: { type: Date, required: true } }, { timestamps: true });
salaryStructureSchema.index({ employee: 1, effectiveFrom: -1 }, { unique: true });

export const SalaryStructure = mongoose.models.SalaryStructure || mongoose.model('SalaryStructure', salaryStructureSchema);
