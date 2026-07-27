import mongoose from 'mongoose';
import { connectDatabase } from './config/db.js';
import { Architect } from './models/architect.model.js';
import { Lead } from './models/lead.model.js';

const demoLeads = [
  ['Urban Nest Interiors', 'manual', 'Website enquiry', 'urban@example.com', '+971501110001', 'PVC HPL'],
  ['Brightline Builders', 'api', 'Partner API', 'brightline@example.com', '+971501110002', 'Compact Laminate'],
  ['Marina Fitout LLC', 'webhook', 'Meta Ads', 'marina@example.com', '+971501110003', 'Decorative HPL'],
  ['Palm View Hotels', 'integration', 'TradeIndia', 'palmview@example.com', '+971501110004', 'Wall Panels'],
  ['Skyline Kitchens', 'csv', 'Expo CSV', 'skyline@example.com', '+971501110005', 'Kitchen Laminates'],
  ['Nexa Retail Group', 'manual', 'Website enquiry', 'nexa@example.com', '+971501110006', 'Store Fixtures'],
  ['Blue Arc Design', 'api', 'Landing Page API', 'bluearc@example.com', '+971501110007', 'Exterior Cladding'],
  ['Crescent Office Works', 'webhook', 'LinkedIn Ads', 'crescent@example.com', '+971501110008', 'Office Partitions'],
  ['Vertex Contracting', 'integration', 'Justdial', 'vertex@example.com', '+971501110009', 'Fire Rated Panels'],
  ['Al Noor Furniture', 'manual', 'Website enquiry', 'alnoor@example.com', '+971501110010', 'Furniture Laminate'],
].map(([name, sourceType, source, email, phone, productInterest]) => ({
  name,
  sourceType,
  source,
  email,
  phone,
  productInterest,
  status: 'NEW',
}));

const demoArchitects = [
  ['Aarav Mehta', 'Studio Axis', 'Dubai', 'Hospitality Interiors', 'aarav.arch@example.com', '+971502220001'],
  ['Nisha Kapoor', 'Kapoor Design Lab', 'Abu Dhabi', 'Residential Villas', 'nisha.arch@example.com', '+971502220002'],
  ['Rohan Shah', 'Urban Form Architects', 'Sharjah', 'Commercial Fitouts', 'rohan.arch@example.com', '+971502220003'],
  ['Meera Iyer', 'Iyer Spatial Works', 'Dubai', 'Retail Spaces', 'meera.arch@example.com', '+971502220004'],
  ['Kabir Malhotra', 'Line & Plane Studio', 'Ajman', 'Office Interiors', 'kabir.arch@example.com', '+971502220005'],
  ['Ananya Rao', 'Northstar Design', 'Dubai', 'Hotels & Resorts', 'ananya.arch@example.com', '+971502220006'],
  ['Vikram Sethi', 'Sethi Associates', 'Abu Dhabi', 'Healthcare Projects', 'vikram.arch@example.com', '+971502220007'],
  ['Priya Menon', 'Canvas Architecture', 'Sharjah', 'Luxury Apartments', 'priya.arch@example.com', '+971502220008'],
  ['Sameer Khan', 'Khan Build Studio', 'Dubai', 'Facade Design', 'sameer.arch@example.com', '+971502220009'],
  ['Leena Thomas', 'ArchiCraft Studio', 'Ras Al Khaimah', 'Educational Spaces', 'leena.arch@example.com', '+971502220010'],
].map(([name, company, city, specialty, email, phone]) => ({
  name,
  company,
  city,
  specialty,
  email,
  phone,
  status: 'active',
  notes: 'Dummy architect profile',
}));

async function seed() {
  await connectDatabase();

  for (const lead of demoLeads) {
    if (!(await Lead.exists({ email: lead.email }))) {
      await Lead.create(lead);
    }
  }

  for (const architect of demoArchitects) {
    if (!(await Architect.exists({ email: architect.email }))) {
      await Architect.create(architect);
    }
  }

  console.log(`Seeded ${demoLeads.length} demo leads`);
  console.log(`Seeded ${demoArchitects.length} demo architects`);
}

seed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
