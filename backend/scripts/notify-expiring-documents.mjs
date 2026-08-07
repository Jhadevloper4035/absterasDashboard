import mongoose from 'mongoose';
import { connectDatabase } from '../src/config/db.js';
import { Employee } from '../src/models/employee.model.js';
import { Notification } from '../src/models/notification.model.js';
import { notifyUsers } from '../src/services/notification.service.js';

const today = new Date();
today.setUTCHours(0, 0, 0, 0);
const deadline = new Date(today);
deadline.setUTCDate(deadline.getUTCDate() + 30);

try {
  await connectDatabase();
  const employees = await Employee.find({ 'documents.expiresAt': { $gte: today, $lte: deadline } }).populate('user', 'name');
  let notified = 0;
  for (const employee of employees) for (const document of employee.documents.filter((item) => item.expiresAt >= today && item.expiresAt <= deadline)) {
    const metadata = { type: 'hr.document.expiring', documentKey: document.key, expiresAt: document.expiresAt.toISOString() };
    if (await Notification.exists({ user: employee.user._id, 'metadata.type': metadata.type, 'metadata.documentKey': metadata.documentKey, 'metadata.expiresAt': metadata.expiresAt })) continue;
    await notifyUsers([employee.user._id], { title: 'Document expiring', body: `${document.type} expires on ${document.expiresAt.toISOString().slice(0, 10)}.`, metadata });
    notified += 1;
  }
  console.log(`Document expiry check complete: ${notified} notification(s) sent.`);
} finally {
  await mongoose.disconnect();
}
