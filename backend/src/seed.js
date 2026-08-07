import mongoose from 'mongoose';
import { connectDatabase } from './config/db.js';
import { Architect } from './modules/leads/models/architect.model.js';
import { Lead } from './modules/leads/models/lead.model.js';
import { Client } from './modules/clients/models/client.model.js';
import { Challan } from './modules/challans/models/challan.model.js';
import { Invoice } from './modules/invoices/models/invoice.model.js';
import { Task } from './modules/tasks/models/task.model.js';
import { User } from './models/user.model.js';
import { hashPassword } from './modules/auth/services/password.service.js';

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
  ['Reassign stale leads', 'Move overdue uncontacted leads to the manager exception queue.', 'Blocked', 'High', 'Assignment'],
  ['Audit pending follow-ups', 'Find follow-ups due today and mark missed items for escalation.', 'Testing', 'Medium', 'Follow Ups'],
  ['Create pipeline export sample', 'Generate a manager-friendly pipeline CSV sample.', 'Backlog', 'Low', 'Reports'],
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
  await connectDatabase();

  let userCount = 0;
  for (const { password, ...user } of demoUsers) {
    const result = await User.updateOne(
      { email: user.email },
      { $set: { ...user, passwordHash: await hashPassword(password) } },
      { upsert: true, runValidators: true },
    );
    if (result.upsertedCount || result.modifiedCount) userCount += 1;
  }

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

  const creator = await User.findOne({ status: 'active', role: { $in: ['admin', 'superadmin'] } }).sort({ role: 1, createdAt: 1 });
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
}

seed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
