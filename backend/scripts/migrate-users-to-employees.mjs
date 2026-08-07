import mongoose from 'mongoose';
import { connectDatabase } from '../src/config/db.js';
import { Department } from '../src/models/department.model.js';
import { Designation } from '../src/models/designation.model.js';
import { Employee } from '../src/models/employee.model.js';
import { User } from '../src/models/user.model.js';

try {
  await connectDatabase();
  const excludedRoles = ['sales', 'admin', 'superadmin'];
  const [department, designation] = await Promise.all([
    Department.findOneAndUpdate({ name: 'Unassigned' }, { $setOnInsert: { description: 'Created by employee migration' } }, { upsert: true, new: true }),
    Designation.findOneAndUpdate({ name: 'Unassigned' }, { $setOnInsert: { description: 'Created by employee migration' } }, { upsert: true, new: true }),
  ]);
  const users = await User.find({ role: { $nin: excludedRoles } }).select('_id createdAt');
  const excludedUsers = await User.find({ role: { $in: ['admin', 'superadmin'] } }).select('_id');
  await Promise.all([
    User.updateMany({ role: { $nin: excludedRoles } }, { $addToSet: { accessTypes: 'employee' } }),
    User.updateMany({ role: { $in: ['admin', 'superadmin'] } }, { $pull: { accessTypes: 'employee' } }),
    Employee.deleteMany({ user: { $in: excludedUsers.map((user) => user._id) } }),
  ]);
  const operations = users.map((user) => ({
    updateOne: {
      filter: { user: user._id },
      update: { $setOnInsert: { user: user._id, employeeType: 'office', department: department._id, designation: designation._id, joiningDate: user.createdAt || new Date(), status: 'active' } },
      upsert: true,
    },
  }));
  const result = operations.length ? await Employee.bulkWrite(operations) : { upsertedCount: 0 };
  console.log(`Employee migration complete: ${result.upsertedCount || 0} created, ${users.length} non-sales/non-admin users enabled as employees.`);
} finally {
  await mongoose.disconnect();
}
