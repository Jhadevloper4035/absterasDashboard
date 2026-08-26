import { CategoryDefinition } from '../models/category-definition.model.js';

export async function validateSpecs(category, specs = {}) {
  const definition = await CategoryDefinition.findOne({ slug: category }).lean();
  if (!definition) throw Object.assign(new Error('Unknown category'), { statusCode: 400 });
  if (!specs || Array.isArray(specs) || typeof specs !== 'object') throw Object.assign(new Error('Specs must be an object'), { statusCode: 400 });
  const allowed = new Map(definition.fields.map((field) => [field.key, field]));
  for (const key of Object.keys(specs)) if (!allowed.has(key)) throw Object.assign(new Error(`Unknown specification: ${key}`), { statusCode: 400 });
  for (const field of definition.fields) {
    const value = specs[field.key];
    if (field.required && (value === undefined || value === null || value === '')) throw Object.assign(new Error(`${field.label} is required`), { statusCode: 400 });
    if (value === undefined || value === null || value === '') continue;
    if (field.type === 'number' && (!Number.isFinite(value) || typeof value !== 'number')) throw Object.assign(new Error(`${field.label} must be a number`), { statusCode: 400 });
    if (field.type === 'string' && typeof value !== 'string') throw Object.assign(new Error(`${field.label} must be text`), { statusCode: 400 });
    if (field.type === 'boolean' && typeof value !== 'boolean') throw Object.assign(new Error(`${field.label} must be true or false`), { statusCode: 400 });
  }
  return definition;
}
