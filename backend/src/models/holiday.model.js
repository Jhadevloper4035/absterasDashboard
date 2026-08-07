import mongoose from 'mongoose';

const holidaySchema = new mongoose.Schema({ date: { type: Date, required: true, unique: true }, name: { type: String, required: true, trim: true }, type: { type: String, enum: ['government', 'festival', 'private'], default: 'festival' } }, { timestamps: true });

export const Holiday = mongoose.models.Holiday || mongoose.model('Holiday', holidaySchema);
