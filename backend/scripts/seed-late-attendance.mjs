import mongoose from 'mongoose';
import { connectDatabase } from '../src/config/db.js';
import { Attendance } from '../src/models/attendance.model.js';
import { Employee } from '../src/models/employee.model.js';
import { User } from '../src/models/user.model.js';
import { calculateAttendance } from '../src/services/attendance.service.js';

try {
  await connectDatabase();
  const [admin, employees] = await Promise.all([
    User.findOne({ role: { $in: ['superadmin', 'admin'] }, status: 'active' }),
    Employee.find({ status: 'active' }).sort({ createdAt: 1 }).limit(3),
  ]);
  if (!admin) throw new Error('An active admin is required');
  const date = new Date(); date.setUTCHours(0, 0, 0, 0);
  for (const employee of employees) {
    const calculated = calculateAttendance({ employeeType: employee.employeeType, status: 'present', checkIn: '10:45', checkOut: '18:00' });
    await Attendance.updateOne({ employee: employee._id, date }, { $set: { employee: employee._id, date, checkIn: '10:45', checkOut: '18:00', markedBy: admin._id, ...calculated } }, { upsert: true });
  }
  console.log(`Late attendance added for ${employees.length} employee profiles.`);
} finally {
  await mongoose.disconnect();
}
