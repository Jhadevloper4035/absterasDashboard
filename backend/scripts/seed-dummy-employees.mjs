import mongoose from 'mongoose';
import { connectDatabase } from '../src/config/db.js';
import { Department } from '../src/models/department.model.js';
import { Designation } from '../src/models/designation.model.js';
import { Employee } from '../src/models/employee.model.js';
import { SalaryStructure } from '../src/models/salary-structure.model.js';
import { User } from '../src/models/user.model.js';
import { hashPassword } from '../src/services/password.service.js';

const people = [
  ['Aarav Sharma', 'aarav.sharma@example.com', 'operations', 'Operations', 'Coordinator', 5500],
  ['Diya Patel', 'diya.patel@example.com', 'operations', 'Operations', 'Executive', 6000],
  ['Kabir Singh', 'kabir.singh@example.com', 'accounts', 'Accounts', 'Accountant', 6500],
  ['Meera Nair', 'meera.nair@example.com', 'accounts', 'Accounts', 'Finance Executive', 6200],
  ['Rohan Verma', 'rohan.verma@example.com', 'designers', 'Design', 'Interior Designer', 7000],
  ['Ananya Gupta', 'ananya.gupta@example.com', 'designers', 'Design', 'Designer', 6800],
  ['Vikram Joshi', 'vikram.joshi@example.com', 'operations', 'Operations', 'Site Coordinator', 5800],
  ['Isha Khan', 'isha.khan@example.com', 'accounts', 'Accounts', 'Billing Executive', 5400],
  ['Neel Kapoor', 'neel.kapoor@example.com', 'designers', 'Design', 'Junior Designer', 5000],
  ['Sara Thomas', 'sara.thomas@example.com', 'operations', 'Operations', 'Operations Executive', 6100],
];

try {
  await connectDatabase();
  const passwordHash = await hashPassword('Employee123!');
  let created = 0;
  for (const [name, email, role, departmentName, designationName, salary] of people) {
    const department = await Department.findOneAndUpdate({ name: departmentName }, { $setOnInsert: { description: 'Dummy employee data' } }, { upsert: true, new: true });
    const designation = await Designation.findOneAndUpdate({ name: designationName }, { $setOnInsert: { department: department._id, description: 'Dummy employee data' } }, { upsert: true, new: true });
    const user = await User.findOneAndUpdate({ email }, { $set: { name, phone: `+97150000${String(created + 100).slice(-4)}`, passwordHash, role, status: 'active', timezone: 'Asia/Dubai' }, $addToSet: { accessTypes: 'employee' } }, { upsert: true, new: true, runValidators: true });
    const employee = await Employee.findOneAndUpdate({ user: user._id }, { $setOnInsert: { user: user._id, employeeType: 'office', department: department._id, designation: designation._id, joiningDate: new Date('2026-01-01'), status: 'active' } }, { upsert: true, new: true });
    await SalaryStructure.findOneAndUpdate({ employee: employee._id, effectiveFrom: new Date('2026-01-01') }, { $setOnInsert: { employee: employee._id, ctc: salary, basic: salary * 0.7, hra: salary * 0.3, effectiveFrom: new Date('2026-01-01') } }, { upsert: true, new: true });
    created += 1;
  }
  console.log(`Dummy employee seed complete: ${created} employees available. Login password: Employee123!`);
} finally {
  await mongoose.disconnect();
}
