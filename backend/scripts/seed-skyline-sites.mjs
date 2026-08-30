import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { connectDatabase } from '../src/config/db.js';
import { Client } from '../src/modules/clients/models/client.model.js';

const sites = [
  ['Skyline Indiranagar Showroom', '100 Feet Road, Indiranagar, Bengaluru, Karnataka 560038'],
  ['Skyline Whitefield Studio', 'ITPL Main Road, Whitefield, Bengaluru, Karnataka 560066'],
];

async function seed() {
  if (env.nodeEnv !== 'development') throw new Error('Skyline test sites can only be seeded in development');
  await connectDatabase();
  const parent = await Client.findOne({ name: 'Skyline Kitchens', parentClient: null });
  if (!parent) throw new Error('Skyline Kitchens was not found. Run the normal development seed first.');

  let created = 0;
  let updated = 0;
  for (const [siteName, siteAddress] of sites) {
    const existing = await Client.findOne({ parentClient: parent._id, siteAddress });
    if (existing) {
      await Client.updateOne({ _id: existing._id }, { $set: { billingAddress: siteAddress, shippingAddress: siteAddress } });
      updated += 1;
      continue;
    }
    await Client.create({
      name: parent.name,
      parentClient: parent._id,
      siteName,
      siteAddress,
      billingAddress: siteAddress,
      shippingAddress: siteAddress,
      state: 'Karnataka',
      stateCode: '29',
      phone: parent.phone,
      gstin: parent.gstin,
      email: `skyline.${siteName.toLowerCase().replaceAll(' ', '.')}@example.com`,
      status: 'active',
      notes: 'Development test site.',
    });
    created += 1;
  }
  console.log(`Skyline Kitchens development sites ready (${created} created, ${updated} updated).`);
}

seed()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
