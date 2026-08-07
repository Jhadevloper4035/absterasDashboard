import mongoose from 'mongoose';
import { connectDatabase } from '../src/config/db.js';
import { User } from '../src/models/user.model.js';
import { hashPassword } from '../src/services/password.service.js';

try {
  await connectDatabase();
  await User.findOneAndUpdate(
    { email: 'codex.hr@example.com' },
    { $set: { name: 'Codex HR Manager', phone: '+971500000002', passwordHash: await hashPassword('HrManager123!'), role: 'operations', accessTypes: ['hr-management'], status: 'active', timezone: 'Asia/Dubai' } },
    { upsert: true, new: true, runValidators: true },
  );
  console.log('HR Manager demo account is ready: codex.hr@example.com');
} finally {
  await mongoose.disconnect();
}
