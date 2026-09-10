import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const backendDir = resolve(scriptDir, '..');
const developmentEnv = dotenv.parse(readFileSync(resolve(backendDir, '../.env.development')));
const productionEnv = dotenv.parse(readFileSync(resolve(backendDir, '../.env')));
const sourceUri = process.env.SOURCE_MONGODB_URI || developmentEnv.MONGODB_URI;
const targetUri = process.env.TARGET_MONGODB_URI || productionEnv.MONGODB_URI;
const apply = process.env.APPLY_PRODUCTION_USER_SYNC === 'true';
const confirmation = process.env.CONFIRM_PRODUCTION_USER_SYNC;
const allowedProfiles = new Set(['employee', 'director', 'admin', 'superadmin']);
const userFields = ['_id', 'name', 'email', 'passwordHash', 'phone', 'whatsappNumber', 'role', 'additionalRoles', 'accessTypes', 'workProfile', 'modulePermissions', 'status', 'manager', 'timezone', 'notificationPreferences', 'createdAt', 'updatedAt'];

function copyFields(document, fields) {
  return Object.fromEntries(fields.filter((field) => document[field] !== undefined).map((field) => [field, document[field]]));
}

function isIncludedUser(user) {
  return allowedProfiles.has(user.workProfile) || ['admin', 'superadmin'].includes(user.role);
}

function assertConnections(source, target) {
  if (!/(dev|development)/i.test(source.name)) throw new Error('Source database must be a development database');
  if (!/(prod|production)/i.test(target.name)) throw new Error('Target database must be a production database');
}

const sourceConnection = await mongoose.createConnection(sourceUri, { serverSelectionTimeoutMS: 10000 }).asPromise();
const targetConnection = await mongoose.createConnection(targetUri, { serverSelectionTimeoutMS: 10000 }).asPromise();

try {
  assertConnections(sourceConnection, targetConnection);
  const sourceDb = sourceConnection.db;
  const targetDb = targetConnection.db;
  const sourceUsers = (await sourceDb.collection('users').find({}).toArray()).filter(isIncludedUser);
  const sourceUserIds = new Set(sourceUsers.map((user) => String(user._id)));
  const defaultGrantor = sourceUsers.find((user) => user.workProfile === 'superadmin' || user.role === 'superadmin' || user.workProfile === 'admin' || user.role === 'admin')?._id;
  if (!defaultGrantor) throw new Error('Development data needs an admin or superadmin user to grant copied access');
  const sourceEmployees = await sourceDb.collection('employees').find({ user: { $in: sourceUsers.map((user) => user._id) } }).toArray();
  const sourceDepartments = sourceEmployees.length ? await sourceDb.collection('departments').find({ _id: { $in: sourceEmployees.map((employee) => employee.department) } }).toArray() : [];
  const sourceDesignations = sourceEmployees.length ? await sourceDb.collection('designations').find({ _id: { $in: sourceEmployees.map((employee) => employee.designation) } }).toArray() : [];
  const sourceInventoryPermissions = await sourceDb.collection('inventorypermissions').find({ user: { $in: sourceUsers.map((user) => user._id) } }).toArray();
  const sourceHrPermissions = await sourceDb.collection('hrpermissions').find({ user: { $in: sourceUsers.map((user) => user._id) } }).toArray();
  const targetUserCount = await targetDb.collection('users').countDocuments();

  console.log(JSON.stringify({
    mode: apply ? 'APPLY' : 'DRY_RUN',
    sourceDatabase: sourceConnection.name,
    targetDatabase: targetConnection.name,
    deleteFromProduction: { users: targetUserCount, employees: await targetDb.collection('employees').countDocuments(), inventoryPermissions: await targetDb.collection('inventorypermissions').countDocuments(), hrPermissions: await targetDb.collection('hrpermissions').countDocuments() },
    createFromDevelopment: { users: sourceUsers.length, employees: sourceEmployees.length, inventoryPermissions: sourceInventoryPermissions.length, hrPermissions: sourceHrPermissions.length },
  }, null, 2));

  if (!apply) {
    console.log('Dry run only. No production data was changed.');
    process.exitCode = 0;
  } else {
    if (confirmation !== 'RESET_PRODUCTION_USERS_FROM_DEVELOPMENT') throw new Error('Set CONFIRM_PRODUCTION_USER_SYNC=RESET_PRODUCTION_USERS_FROM_DEVELOPMENT before applying');
    if (process.env.ALLOW_ORPHANED_USER_REFERENCES !== 'true') throw new Error('Set ALLOW_ORPHANED_USER_REFERENCES=true after reviewing production records that reference current users');

    const session = await targetConnection.startSession();
    try {
      await session.withTransaction(async () => {
        const departmentIdBySourceId = new Map();
        for (const department of sourceDepartments) {
          const result = await targetDb.collection('departments').findOneAndUpdate({ name: department.name }, { $setOnInsert: { name: department.name, description: department.description, createdAt: new Date(), updatedAt: new Date() } }, { upsert: true, returnDocument: 'after', session });
          departmentIdBySourceId.set(String(department._id), result._id);
        }
        const designationIdBySourceId = new Map();
        for (const designation of sourceDesignations) {
          const department = designation.department ? departmentIdBySourceId.get(String(designation.department)) : undefined;
          const result = await targetDb.collection('designations').findOneAndUpdate({ name: designation.name }, { $setOnInsert: { name: designation.name, department, description: designation.description, createdAt: new Date(), updatedAt: new Date() } }, { upsert: true, returnDocument: 'after', session });
          designationIdBySourceId.set(String(designation._id), result._id);
        }

        await Promise.all([
          targetDb.collection('inventorypermissions').deleteMany({}, { session }),
          targetDb.collection('hrpermissions').deleteMany({}, { session }),
          targetDb.collection('employees').deleteMany({}, { session }),
          targetDb.collection('users').deleteMany({}, { session }),
        ]);

        const users = sourceUsers.map((user) => {
          const copy = copyFields(user, userFields);
          if (copy.manager && !sourceUserIds.has(String(copy.manager))) delete copy.manager;
          return copy;
        });
        if (users.length) await targetDb.collection('users').insertMany(users, { session });

        const employees = sourceEmployees.map((employee) => ({
          _id: employee._id,
          user: employee.user,
          employeeType: employee.employeeType,
          department: departmentIdBySourceId.get(String(employee.department)),
          designation: designationIdBySourceId.get(String(employee.designation)),
          ...(employee.manager && sourceUserIds.has(String(employee.manager)) ? { manager: employee.manager } : {}),
          joiningDate: employee.joiningDate,
          status: employee.status,
          createdAt: employee.createdAt,
          updatedAt: employee.updatedAt,
        }));
        if (employees.length) await targetDb.collection('employees').insertMany(employees, { session });
        const accessCopies = (permissions) => permissions.map((permission) => ({ ...permission, grantedBy: sourceUserIds.has(String(permission.grantedBy)) ? permission.grantedBy : defaultGrantor }));
        if (sourceInventoryPermissions.length) await targetDb.collection('inventorypermissions').insertMany(accessCopies(sourceInventoryPermissions), { session });
        if (sourceHrPermissions.length) await targetDb.collection('hrpermissions').insertMany(accessCopies(sourceHrPermissions), { session });
      });
    } finally {
      await session.endSession();
    }
    console.log('Production user and employee access sync complete. No business collections were changed.');
  }
} finally {
  await Promise.all([sourceConnection.close(), targetConnection.close()]);
}
