import mongoose from 'mongoose';
import { connectDatabase } from './config/db.js';
import { env } from './config/env.js';
import { Architect } from './modules/leads/models/architect.model.js';
import { Lead } from './modules/leads/models/lead.model.js';
import { Client } from './modules/clients/models/client.model.js';
import { Challan } from './modules/challans/models/challan.model.js';
import { Invoice } from './modules/invoices/models/invoice.model.js';
import { Task } from './modules/tasks/models/task.model.js';
import { User } from './models/user.model.js';
import { hashPassword } from './modules/auth/services/password.service.js';
import { CategoryDefinition } from './modules/inventory/models/category-definition.model.js';
import { InventoryItem } from './modules/inventory/models/item.model.js';
import { InventoryPermission, INVENTORY_MODULES } from './modules/inventory/models/permission.model.js';
import { Supplier } from './modules/inventory/models/supplier.model.js';
import { StockTransaction } from './modules/inventory/models/transaction.model.js';
import { LaserCutVendor } from './modules/lasercut/models.js';
import { PowderCoatVendor } from './modules/powdercoating/models.js';

const inventoryCategories = [
  ['tube', 'Tube', [['size', 'Size', 'string', true], ['length', 'Length (mm)', 'number', true, 'mm'], ['thickness', 'Thickness (mm)', 'number', true, 'mm'], ['coating', 'Coating/Paint', 'string']]],
  ['sheet', 'Sheet', [['size', 'Size (ft)', 'string'], ['thickness', 'Thickness (mm)', 'number', true, 'mm'], ['coating', 'Coating/Shade', 'string']]],
  ['profile', 'Profile / Section', [['codeOrSize', 'Code/Size', 'string', true], ['length', 'Length (mm)', 'number', true, 'mm'], ['width', 'Width (mm)', 'number', true, 'mm'], ['thickness', 'Thickness (mm)', 'number', true, 'mm']]],
  ['hand_rail', 'Hand Rail', [['size', 'Size', 'string', true], ['length', 'Length (mm)', 'number', true, 'mm'], ['thickness', 'Thickness (mm)', 'number', true, 'mm']]],
  ['bottom_rail', 'Bottom Rail', [['size', 'Size', 'string', true], ['length', 'Length (mm)', 'number', true, 'mm'], ['thickness', 'Thickness (mm)', 'number', true, 'mm']]],
  ['hardware', 'Hardware', [['hardwareType', 'Hardware Type', 'string', true], ['size', 'Size', 'string', true], ['length', 'Length (mm)', 'number', true, 'mm']]],
].map(([slug, label, fields]) => ({ slug, label, fields: fields.map(([key, fieldLabel, type, required = false, unit]) => ({ key, label: fieldLabel, type, required, unit })) }));
const demoInventoryItems = [
  ['TUBE-0001', 'tube', 'Aluminium Tube 25x50', 'pcs', 100, 25, 'A-01', 42, '7608', { size: '25x50', length: 3657, thickness: 1, coating: 'Powder coated white' }],
  ['TUBE-0002', 'tube', 'Aluminium Tube 50x50', 'pcs', 18, 25, 'A-02', 54, '7608', { size: '50x50', length: 3657, thickness: 1.2, coating: 'Mill finish' }],
  ['TUBE-0003', 'tube', 'Aluminium Tube 25x25', 'pcs', 72, 20, 'A-03', 35, '7608', { size: '25x25', length: 3657, thickness: 1, coating: 'Anodized silver' }],
  ['SHT-0001', 'sheet', 'Aluminium Sheet 4x8 ft', 'sheet', 30, 10, 'B-01', 180, '7606', { size: '4 × 8 ft', thickness: 1.2, coating: 'Silver' }, { heightFt: 8, widthFt: 4 }],
  ['SHT-0002', 'sheet', 'Aluminium Sheet 4x10 ft', 'sheet', 8, 10, 'B-02', 225, '7606', { size: '4 × 10 ft', thickness: 1.5, coating: 'Black' }, { heightFt: 10, widthFt: 4 }],
  ['SHT-0003', 'sheet', 'Aluminium Sheet 5x10 ft', 'sheet', 16, 8, 'B-03', 270, '7606', { size: '5 × 10 ft', thickness: 2, coating: 'White' }, { heightFt: 10, widthFt: 5 }],
  ['PRF-0001', 'profile', 'U Profile 40mm', 'meter', 80, 20, 'C-01', 18, '7604', { codeOrSize: 'U-40', length: 6000, width: 40, thickness: 1.2 }],
  ['HR-0001', 'hand_rail', 'Hand Rail 50x25', 'meter', 44, 15, 'D-01', 35, '7604', { size: '50x25', length: 6000, thickness: 1.5 }],
  ['BR-0001', 'bottom_rail', 'Bottom Rail 60x30', 'meter', 10, 15, 'D-02', 31, '7604', { size: '60x30', length: 6000, thickness: 1.5 }],
  ['HW-0001', 'hardware', 'Truss Head Screw', 'pcs', 500, 100, 'E-01', 0.35, '7318', { hardwareType: 'truss_head', size: 'M4', length: 16 }],
].map(([sku, category, name, unit, quantityInStock, minStockLevel, location, unitCost, hsnCode, specs, defaultDimensions], index) => ({
  sku,
  category,
  name,
  unit,
  quantityInStock,
  minStockLevel,
  location,
  unitCost,
  hsnCode,
  specs,
  shadeName: specs.coating || 'Natural finish',
  shadeCode: `PC-${String(index + 1).padStart(4, '0')}`,
  materialType: category === 'sheet' ? 'SHEET' : category === 'tube' ? 'TUBE' : 'OTHER',
  defaultDimensions: defaultDimensions || (category === 'sheet'
    ? { heightFt: specs.length / 304.8, widthFt: specs.width / 304.8 }
    : category === 'tube'
      ? { lengthFt: specs.length / 304.8 }
      : {}),
}));

const demoSuppliers = [
  ['Apex Aluminium Supplies', 'Ravi Sharma', '+919810000101', 'orders@apexaluminium.example.com', 'Plot 18, Sector 6, IMT Manesar, Gurugram, Haryana 122050', '06AABCA0001A1Z1'],
  ['Metro Metal Traders', 'Neha Verma', '+919810000102', 'sales@metrometal.example.com', 'Shed 42, Udyog Vihar Phase 4, Gurugram, Haryana 122016', '06AABCM0002B1Z2'],
  ['Prime Facade Materials', 'Arjun Singh', '+919810000103', 'dispatch@primefacade.example.com', 'Plot 7, Industrial Area, Sector 58, Faridabad, Haryana 121004', '06AABCP0003C1Z3'],
  ['Vertex Hardware House', 'Pooja Mehta', '+919810000104', 'purchases@vertexhardware.example.com', '17 Okhla Industrial Estate Phase 2, New Delhi 110020', '07AABCV0004D1Z4'],
  ['North Star Profiles', 'Karan Malhotra', '+919810000105', 'supply@northstarprofiles.example.com', 'Plot 91, Noida Special Economic Zone, Noida, Uttar Pradesh 201305', '09AABCN0005E1Z5'],
].map(([name, contactPerson, phone, email, address, taxId]) => ({ name, contactPerson, phone, email, address, taxId, notes: 'Development dummy supplier', status: 'active' }));

const demoLaserCutVendors = [
  ['Precision Laser Works', 'Amit Bansal', '+919810000106', 'orders@precisionlaser.example.com', 'Plot 12, Udyog Vihar, Gurugram, Haryana 122016'],
  ['Cutline Fabrication', 'Sonal Gupta', '+919810000107', 'dispatch@cutline.example.com', 'Shed 21, Sector 37, Faridabad, Haryana 121003'],
].map(([name, contactPerson, phone, email, address]) => ({ name, contactPerson, phone, email, address, notes: 'Development dummy laser-cut vendor', status: 'active' }));

const demoPowderCoatVendors = [
  ['Spectrum Powder Coats', 'Manish Arora', '+919810000108', 'orders@spectrumpowder.example.com', 'Plot 44, IMT Manesar, Gurugram, Haryana 122051'],
  ['FinishPro Coatings', 'Ritika Jain', '+919810000109', 'dispatch@finishpro.example.com', 'Shed 8, Udyog Vihar Phase 2, Gurugram, Haryana 122008'],
].map(([name, contactPerson, phone, email, address]) => ({ name, contactPerson, phone, email, address, notes: 'Development dummy powder-coating vendor', status: 'active' }));

const demoUsers = [
  {
    name: 'Codex Superadmin',
    email: 'codex.superadmin@example.com',
    phone: '+971500000000',
    password: 'CodexAdmin123!',
    role: 'superadmin',
    status: 'active',
    timezone: 'Asia/Dubai',
  },
  {
    name: 'Codex Admin',
    email: 'codex.admin@example.com',
    phone: '+971500000001',
    password: 'CodexAdmin123!',
    role: 'admin',
    status: 'active',
    timezone: 'Asia/Dubai',
  },
  {
    name: 'Codex HR Manager',
    email: 'codex.hr@example.com',
    phone: '+971500000002',
    password: 'HrManager123!',
    role: 'operations',
    accessTypes: ['hr-management'],
    status: 'active',
    timezone: 'Asia/Dubai',
  },
];

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
  ['Arjun Deshpande', 'FacadeWorks Studio', 'Mumbai', 'Metal facade event - Zak Doors & Windows Expo India', 'arjun.deshpande@example.in', '+919820000101'],
  ['Kavya Nair', 'Envelope Design Collective', 'Bengaluru', 'Metal facade event - ACETECH Bengaluru', 'kavya.nair@example.in', '+919820000102'],
  ['Devika Suri', 'Suri Architects', 'New Delhi', 'Metal facade event - India Facade Summit', 'devika.suri@example.in', '+919820000103'],
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

const demoClients = [
  ['Emaar Gomti Green A2-19', 'Emaar Properties', 'Lucknow', '09', 'Gomti Nagar, Lucknow', 250000],
  ['Marina Retail Fitout', 'Marina Retail Group', 'Maharashtra', '27', 'Bandra Kurla Complex, Mumbai', 420000],
  ['Palm View Hotel Lobby', 'Palm View Hotels', 'Delhi', '07', 'Aerocity, New Delhi', 310000],
  ['Skyline Kitchen Project', 'Skyline Kitchens', 'Karnataka', '29', 'Indiranagar, Bengaluru', 180000],
  ['Nexa Store Fixtures', 'Nexa Retail Group', 'Gujarat', '24', 'SG Highway, Ahmedabad', 195000],
].map(([siteName, name, state, stateCode, siteAddress, estimatedValue], index) => ({
  name,
  phone: `+9715033300${index + 1}`,
  email: `projects${index + 1}@${name.toLowerCase().replaceAll(' ', '').replaceAll('.', '')}.example.com`,
  billingAddress: siteAddress,
  shippingAddress: siteAddress,
  state,
  stateCode,
  siteName,
  siteAddress,
  startDate: new Date(Date.UTC(2026, index, 1)),
  status: index === 2 ? 'on hold' : 'active',
  estimatedValue,
  notes: 'Dummy client project for demo use.',
}));

const demoInvoices = [
  ['1/2026-27', 'Emaar Properties', 'ALUMINIUM SHEET', '7606', 100000, 'unpaid'],
  ['2/2026-27', 'Marina Retail Group', 'ALUMINIUM EXTRUSION', '7604', 125000, 'partially paid'],
  ['3/2026-27', 'Palm View Hotels', 'GLASS PANEL', '7007', 80000, 'paid'],
  ['4/2026-27', 'Skyline Kitchens', 'ACP PANEL', '7610', 65000, 'unpaid'],
  ['5/2026-27', 'Nexa Retail Group', 'HARDWARE & FITTINGS', '8302', 45000, 'paid'],
].map(([invoiceNumber, clientName, description, hsnCode, taxableAmount, status], index) => ({
  invoiceNumber,
  clientName,
  description,
  hsnCode,
  taxableAmount,
  status,
  invoiceDate: new Date(Date.UTC(2026, 3, index + 1)),
}));

const demoChallans = [
  ['13', 'Emaar Properties', 'ALUMINIUM EXTRUSION', '7604', 81, 448],
  ['14', 'Marina Retail Group', 'GLASS PANEL', '7007', 20, 2250],
  ['15', 'Palm View Hotels', 'ACP PANEL', '7610', 35, 1200],
  ['16', 'Skyline Kitchens', 'HARDWARE & FITTINGS', '8302', 50, 650],
  ['17', 'Nexa Retail Group', 'ALUMINIUM SHEET', '7606', 12, 3800],
].map(([challanNumber, clientName, description, hsnCode, quantity, rate], index) => ({ challanNumber, clientName, description, hsnCode, quantity, rate, challanDate: new Date(Date.UTC(2026, 6, 24 + index)) }));

const demoTasks = [
  ['Call new website leads', 'Contact all new web enquiries and record the first response.', 'To Do', 'High', 'Lead Intake'],
  ['Review duplicate lead queue', 'Check uncertain phone/email matches before assignment.', 'In Progress', 'Critical', 'Data Quality'],
  ['Prepare WhatsApp reminder template', 'Draft salesperson meeting reminder copy for approval.', 'Review', 'High', 'Notifications'],
  ['Update meeting MOM checklist', 'Confirm required fields for meeting outcome capture.', 'To Do', 'Medium', 'Meetings'],
  ['Reassign stale leads', 'Move overdue uncontacted leads to the manager exception queue.', 'In Progress', 'High', 'Assignment'],
  ['Audit pending follow-ups', 'Find follow-ups due today and mark missed items for escalation.', 'Review', 'Medium', 'Follow Ups'],
  ['Create pipeline export sample', 'Generate a manager-friendly pipeline CSV sample.', 'To Do', 'Low', 'Reports'],
  ['Verify upload attachment rules', 'Test PDF, image, CSV, and rejected file uploads.', 'In Progress', 'Medium', 'Files'],
  ['Document lost reason options', 'List approved lost/on-hold reasons for configuration.', 'To Do', 'Low', 'Configuration'],
  ['Close won demo lead', 'Convert one qualified lead into a customer/deal test record.', 'Done', 'High', 'Conversion'],
].map(([title, description, status, priority, projectEpic], index) => ({
  title,
  description,
  acceptanceCriteria: 'You can see this task in the list with owner, status, priority, and due date.',
  status,
  priority,
  projectEpic,
  labels: ['demo', projectEpic.toLowerCase().replaceAll(' ', '-')],
  dueDate: new Date(Date.UTC(2026, 7, index + 1)),
  definitionOfDone: 'This task appears correctly in the CRM task list.',
  completedAt: status === 'Done' ? new Date(Date.UTC(2026, 6, 29)) : undefined,
}));

async function seed() {
  const databaseName = env.mongoUri?.split('/').at(-1)?.split('?')[0] || '';
  if (process.env.NODE_ENV !== 'development' || process.env.SEED_DEMO_DATA !== 'true' || !/(dev|test|local)/i.test(databaseName)) {
    throw new Error('Demo seed requires NODE_ENV=development, SEED_DEMO_DATA=true, and a development database');
  }

  await connectDatabase();

  let deletedInventoryCount = 0;
  let deletedTransactionCount = 0;
  if (process.env.RESET_DEMO_INVENTORY === 'true') {
    const itemIds = (await InventoryItem.find({}).select('_id').lean()).map((item) => item._id);
    if (itemIds.length) {
      deletedTransactionCount = (await StockTransaction.deleteMany({ item: { $in: itemIds } })).deletedCount;
      deletedInventoryCount = (await InventoryItem.deleteMany({})).deletedCount;
    }
  }

  let userCount = 0;
  for (const { password, ...user } of demoUsers) {
    const result = await User.updateOne(
      { email: user.email },
      { $set: { ...user, passwordHash: await hashPassword(password) } },
      { upsert: true, runValidators: true },
    );
    if (result.upsertedCount || result.modifiedCount) userCount += 1;
  }

  const superadmin = await User.findOne({ role: 'superadmin', status: 'active' });
  if (superadmin) await Promise.all(INVENTORY_MODULES.map((module) => InventoryPermission.findOneAndUpdate({ user: superadmin._id, module }, { access: 'manage', grantedBy: superadmin._id }, { upsert: true, runValidators: true })));
  for (const category of inventoryCategories) await CategoryDefinition.updateOne({ slug: category.slug }, { $set: category }, { upsert: true, runValidators: true });
  const suppliers = await Promise.all(demoSuppliers.map((supplier) => Supplier.findOneAndUpdate({ email: supplier.email }, { $set: supplier }, { new: true, upsert: true, runValidators: true })));
  await Promise.all(demoLaserCutVendors.map((vendor) => LaserCutVendor.findOneAndUpdate({ email: vendor.email }, { $set: vendor }, { new: true, upsert: true, runValidators: true })));
  await Promise.all(demoPowderCoatVendors.map((vendor) => PowderCoatVendor.findOneAndUpdate({ email: vendor.email }, { $set: vendor }, { new: true, upsert: true, runValidators: true })));
  for (const [index, item] of demoInventoryItems.entries()) await InventoryItem.updateOne({ sku: item.sku }, { $set: { ...item, supplier: suppliers[index % suppliers.length]._id, status: 'active' } }, { upsert: true, runValidators: true });

  const creator = await User.findOne({ status: 'active', role: { $in: ['admin', 'superadmin'] } }).sort({ role: 1, createdAt: 1 });
  const inventoryItems = await InventoryItem.find({}).select('_id sku supplier quantityInStock').sort({ sku: 1 });
  let assignedSupplierCount = 0;
  let purchaseCount = 0;
  for (const [index, item] of inventoryItems.entries()) {
    const supplier = item.supplier || suppliers[index % suppliers.length]._id;
    if (!item.supplier) {
      await InventoryItem.updateOne({ _id: item._id }, { $set: { supplier } });
      assignedSupplierCount += 1;
    }
    if (creator && item.quantityInStock > 0 && !(await StockTransaction.exists({ item: item._id, type: 'in' }))) {
      await StockTransaction.create({ item: item._id, type: 'in', quantity: item.quantityInStock, reference: `DEV-OPENING-${item.sku}`, note: 'Development opening purchase', performedBy: creator._id });
      purchaseCount += 1;
    }
  }

  for (const lead of demoLeads) {
    if (!(await Lead.exists({ email: lead.email }))) {
      await Lead.create(lead);
    }
  }

  for (const architect of demoArchitects) {
    if (!(await Architect.exists({ email: architect.email }))) {
      if (creator) await Architect.create({ ...architect, owner: creator._id });
    }
  }

  let clientCount = 0;
  for (const client of demoClients) {
    if (!(await Client.exists({ email: client.email }))) {
      await Client.create(client);
      clientCount += 1;
    }
  }

  let invoiceCount = 0;
  for (const demoInvoice of demoInvoices) {
    if (await Invoice.exists({ invoiceNumber: demoInvoice.invoiceNumber, financialYear: '2026-27' })) continue;
    const client = await Client.findOne({ name: demoInvoice.clientName });
    if (!client) continue;
    const tax = demoInvoice.taxableAmount * 0.18;
    await Invoice.create({
      invoiceNumber: demoInvoice.invoiceNumber,
      financialYear: '2026-27',
      client: client._id,
      invoiceDate: demoInvoice.invoiceDate,
      placeOfSupply: client.state,
      placeOfSupplyCode: client.stateCode,
      lineItems: [{ description: demoInvoice.description, hsnCode: demoInvoice.hsnCode, quantity: 1, unit: 'NOS', unitPrice: demoInvoice.taxableAmount, lineAmount: demoInvoice.taxableAmount }],
      taxableAmount: demoInvoice.taxableAmount,
      igstAmount: tax,
      grandTotal: demoInvoice.taxableAmount + tax,
      status: demoInvoice.status,
    });
    invoiceCount += 1;
  }

  let challanCount = 0;
  for (const demoChallan of demoChallans) {
    if (await Challan.exists({ challanNumber: demoChallan.challanNumber })) continue;
    const client = await Client.findOne({ name: demoChallan.clientName });
    if (!client) continue;
    const taxableAmount = demoChallan.quantity * demoChallan.rate;
    const freightCharge = 2000;
    const gstAmount = taxableAmount * 0.18;
    await Challan.create({ challanNumber: demoChallan.challanNumber, client: client._id, challanDate: demoChallan.challanDate, transportType: 'Road', lineItems: [{ description: demoChallan.description, hsnCode: demoChallan.hsnCode, quantity: demoChallan.quantity, unit: 'NOS', rate: demoChallan.rate, amount: taxableAmount }], freightCharge, taxableAmount, gstAmount, totalAmount: taxableAmount + freightCharge + gstAmount });
    challanCount += 1;
  }

  const assignees = await User.find({ status: 'active', role: { $ne: 'superadmin' } }).sort({ createdAt: 1 });
  let taskCount = 0;

  if (creator && assignees.length) {
    for (const [index, task] of demoTasks.entries()) {
      if (!(await Task.exists({ title: task.title }))) {
        await Task.create({
          ...task,
          assignee: assignees[index % assignees.length]._id,
          createdBy: creator._id,
          completedBy: task.status === 'Done' ? assignees[index % assignees.length]._id : undefined,
        });
        taskCount += 1;
      }
    }
  } else {
    console.log('Skipped demo tasks; create one active admin/superadmin and one active non-superadmin user first');
  }

  console.log(`Seeded ${userCount} demo users`);
  console.log(`Seeded ${demoLeads.length} demo leads`);
  console.log(`Seeded ${demoArchitects.length} demo architects`);
  console.log(`Seeded ${clientCount} demo clients`);
  console.log(`Seeded ${invoiceCount} demo invoices`);
  console.log(`Seeded ${challanCount} demo challans`);
  console.log(`Seeded ${taskCount} demo tasks`);
  console.log(`Seeded ${inventoryCategories.length} inventory categories and ${demoInventoryItems.length} inventory items`);
  console.log(`Ensured ${demoSuppliers.length} demo suppliers, ${demoLaserCutVendors.length} laser-cut vendors, ${demoPowderCoatVendors.length} powder-coating vendors, assigned ${assignedSupplierCount} missing product suppliers, and added ${purchaseCount} opening purchases`);
  if (process.env.RESET_DEMO_INVENTORY === 'true') console.log(`Removed ${deletedInventoryCount} inventory products and ${deletedTransactionCount} stock transactions before seeding`);
}

seed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
