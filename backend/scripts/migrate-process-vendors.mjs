import mongoose from 'mongoose';
import { connectDatabase } from '../src/config/db.js';
import { Supplier } from '../src/modules/inventory/models/supplier.model.js';
import { LaserCutVendor } from '../src/modules/lasercut/models.js';
import { PowderCoatVendor } from '../src/modules/powdercoating/models.js';

async function migrate(vendors, serviceType) {
  const operations = vendors.map((vendor) => ({
    updateOne: {
      filter: { _id: vendor._id },
      update: { $set: { name: vendor.name, contactPerson: vendor.contactPerson, phone: vendor.phone, email: vendor.email, address: vendor.address, notes: vendor.notes, status: vendor.status }, $addToSet: { serviceTypes: serviceType } },
      upsert: true,
    },
  }));
  if (operations.length) await Supplier.bulkWrite(operations);
  return operations.length;
}

await connectDatabase();
try {
  const [laserCut, powderCoating, purchaseMaterials] = await Promise.all([LaserCutVendor.find().lean(), PowderCoatVendor.find().lean(), Supplier.updateMany({ serviceTypes: { $size: 0 } }, { $set: { serviceTypes: ['purchase_material'] } })]);
  const [laserCutCount, powderCoatingCount] = await Promise.all([migrate(laserCut, 'laser_cut'), migrate(powderCoating, 'powder_coating')]);
  console.log(`Migrated ${laserCutCount} laser-cut, ${powderCoatingCount} powder-coating, and ${purchaseMaterials.modifiedCount} purchase-material vendors to Vendor Management.`);
} finally {
  await mongoose.disconnect();
}
