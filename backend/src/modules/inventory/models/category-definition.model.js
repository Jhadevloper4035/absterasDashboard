import mongoose from 'mongoose';

const fieldSchema = new mongoose.Schema({
  key: { type: String, required: true, trim: true, match: /^[a-z][a-zA-Z0-9]*$/ },
  label: { type: String, required: true, trim: true },
  type: { type: String, enum: ['string', 'number', 'boolean', 'date'], required: true },
  required: { type: Boolean, default: false },
  unit: { type: String, trim: true },
}, { _id: false });

const schema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true, trim: true, lowercase: true, match: /^[a-z][a-z0-9_]*$/ },
  label: { type: String, required: true, trim: true },
  fields: { type: [fieldSchema], default: [] },
}, { timestamps: true });
export const CategoryDefinition = mongoose.models.CategoryDefinition || mongoose.model('CategoryDefinition', schema);
