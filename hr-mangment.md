# HR Management Module — Build Plan
### For: absterasDashboard (Node.js/Express/Mongoose backend, Vite/React/TS frontend)

---

## Ground Rules for AI-Assisted Building

Give these to any AI (or dev) building a step below. They apply to every step, no exceptions.

1. **Reuse before you build.** Before writing a new model, controller, hook, or component, check if something equivalent already exists in the repo (`lead.model.js`, `task.controller.js`, `user.routes.js`, etc.) and copy that pattern. Do not invent a new folder structure, naming style, or response shape.
2. **Use the library that's already installed.** Don't add a new npm package if an existing dependency already does the job:
   - Dates/time math → `dayjs` (already installed) — never write manual date math.
   - Forms + validation → `react-hook-form` + `yup` (already installed) — don't hand-roll form state.
   - Tables → `@tanstack/react-table` or `gridjs-react` (both already installed, pick whichever the closest existing page uses).
   - HTTP calls → `axios` (already installed) — use the existing configured instance if one exists.
   - Alerts/confirmations → `sweetalert2` (already installed).
   - Toasts → `react-toastify` (already installed).
   - Select/dropdowns → `react-select` (already installed).
   - Calendar views (leave calendar, holiday calendar) → `@fullcalendar/react` (already installed) — don't build a custom calendar grid.
   - File uploads (documents, receipts) → reuse existing `upload.middleware.js` + `upload.service.js` (S3 via `@aws-sdk/client-s3`), don't create a second upload path.
   - Emails → reuse existing `email.service.js` (nodemailer), don't add a new mail library.
   - PDF generation (payslips) → check if a PDF lib is already used elsewhere in the repo before adding one; if none exists, use the lightest option available (e.g. `pdfkit`) and wrap it in one shared `generatePdf()` helper, not one-off code per document type.
3. **DRY — one implementation per concern.** Example: one `authorizeHrModule()` middleware used by every HR route, not copy-pasted permission checks. One `<DataTable>` wrapper reused across Employees/Attendance/Leave/Payroll lists, not five separate table components. One salary/attendance calculation function, called from both the payroll preview and the final payroll run — never duplicated.
4. **Don't over-engineer.** No abstract "generic module factory," no premature microservices, no config-driven dynamic form builder unless actually asked for. Write the direct, obvious version first (mirroring how `lead.*` / `task.*` are written today). Add abstraction only when the same code is about to be copy-pasted a 3rd time.
5. **Match existing conventions exactly:**
   - Backend: `routes/*.routes.js` → `controllers/*.controller.js` → `models/*.model.js`, wrapped in `asyncHandler`, guarded by `authenticate` + role/permission middleware, mounted in `app.js`.
   - Frontend: `app/(admin)/<module>/page.tsx`, lazy-imported in `routes/index.tsx`, list/create/detail pages follow the same file layout as `leads/`.
   - Every new list-producing endpoint supports pagination/filtering the same way `listLeads` does — don't invent a different query-param scheme.
6. **One feature, one PR/step.** Each numbered step below should be built, tested, and working end-to-end (API + UI) before starting the next. Don't build Payroll before Attendance is producing real data — Payroll depends on it.
7. **No fake/mock data left behind.** Seed data goes in `seed.js` (already exists) if needed for dev, never hardcoded into components.

---

## Step 0 — Permission System (prerequisite for all HR modules)

**Backend**
- `models/hr-permission.model.js` — `{ user, module, access: none|view|manage, grantedBy }`, unique index on `(user, module)`.
- `middleware/auth.middleware.js` — add `authorizeHrModule(module, minAccess)`. Admin/superadmin bypass; everyone else checked against `HrPermission`.
- `routes/hr-permission.routes.js` + `controllers/hr-permission.controller.js`:
  - `GET /api/hr/permissions/:userId`
  - `PUT /api/hr/permissions/:userId` (upserts all modules at once; logs via existing `audit.service.js`)
- Mount in `app.js`.

**Frontend**
- `app/(admin)/hr/settings/access/page.tsx` — user picker + table (rows = HR modules, columns = None/View/Manage). Use `react-select` for user picker, plain radio/select per cell, `axios` + `sweetalert2` confirm on save.
- Add sidebar entry (admin-only, same pattern as existing admin-only menu items).

**Done when:** Admin can open the page, pick any user, set per-module access, save, and reload shows persisted values.

---

## Step 1 — Employee Management

**Backend**
- `models/department.model.js`, `models/designation.model.js` — simple `{ name, description }`.
- `models/employee.model.js` — references `User._id` (1:1), adds: `employeeType: office|site`, `department`, `designation`, `manager` (ref User), `joiningDate`, `status: active|resigned|terminated`, `lastWorkingDate`, `documents: [{ type, url, uploadedAt }]`, `emergencyContact: { name, phone, relation }`.
- CRUD routes/controllers for Department, Designation, Employee — mirror `lead.routes.js` exactly.
- Document upload reuses existing `upload.routes.js` / `upload.service.js`.
- **Migrate existing Users into Employees:** every current `User` (superadmin/admin/sales/operations/accounts/designers) must get a matching `Employee` record so nobody has to be re-entered. One-time script `scripts/migrate-users-to-employees.mjs` (same style as existing `scripts/*.mjs`) that loops all `User` docs and creates an `Employee` for any that don't have one yet — required fields (`department`, `designation`, `employeeType`, `joiningDate`) get sensible defaults/placeholders admin can edit afterward. Run once via `node scripts/migrate-users-to-employees.mjs`, not as an auto-run migration on every boot. After this runs, every logged-in user (not just future hires) has an Employee profile and can immediately use Attendance/Leave/Payroll self-service in later steps.

**Frontend**
- `hr/employees/page.tsx` (list, `@tanstack/react-table` or `gridjs-react` — match whatever `leads/page.tsx` uses)
- `hr/employees/create/page.tsx` (form: `react-hook-form` + `yup`)
- `hr/employees/[employeeId]/page.tsx` (profile + documents + onboarding/offboarding status)
- `hr/settings/departments/page.tsx`, `hr/settings/designations/page.tsx` (simple CRUD tables)
- ID card generation: one shared `generateIdCardPdf(employee)` helper (see PDF note in ground rules).

**Done when:** Admin can create a department/designation, create an employee linked to an existing User, upload documents, view profile, mark offboarded — **and every existing User in the system already has a corresponding Employee record after running the migration script.**

---

## Step 2 — Attendance Management

**Backend**
- `models/holiday.model.js` — `{ date, name }`.
- `models/attendance.model.js` — `{ employee, date, checkIn, checkOut, status: present|absent|half-day|late, isRegularized, overtimeMinutes, markedBy }`. Unique index `(employee, date)`.
- Config: single shift stored once (e.g. in a small `Settings` model or `.env` — don't build multi-shift infra since you confirmed one shift only).
- **Attendance is marked centrally, not self-service.** Only the one person granted `manage` access on the `attendance` HR module (via the Step 0 permission system) can mark/edit attendance — for themselves and everyone else. No employee self check-in/check-out endpoint. Every write to `attendance.model.js` stores `markedBy` (that person's User id) for accountability. `authorizeHrModule('attendance', 'manage')` on the write routes enforces this — other employees get read-only access to their own records (`view` level, or none).
- Controller logic:
  - Single "mark attendance" endpoint (`POST /api/hr/attendance`) — bulk-capable (mark a whole day for multiple employees at once, since one person is doing this daily) rather than a one-employee-at-a-time check-in flow.
  - Overtime calculated **only when `employee.employeeType === 'site'`** — one shared `calculateOvertime()` function, not duplicated per route.
  - Regularization: since the same person marks and corrects attendance, this can just be an edit to the existing record (with an `isRegularized` flag + reason) rather than a separate request/approval workflow — keeps this simple per the "don't over-engineer" rule.
  - Reports endpoint with date-range + department filters (reuse `listLeads`-style query pattern).

**Frontend**
- `hr/attendance/page.tsx` — the designated person's daily/bulk marking screen (mark present/absent/late/half-day per employee for the day) — this is the only write UI for attendance.
- `hr/attendance/reports/page.tsx` — filterable report table (visible to admin/accounts per permission).
- `hr/settings/holidays/page.tsx` — CRUD calendar using `@fullcalendar/react`.

**Done when:** Only the designated attendance-manager can mark/edit attendance (for all employees, in bulk, from one screen), late/overtime auto-computed correctly per employeeType, holidays exclude from absence calc, every record shows who marked it.

---

## Step 3 — Leave Management

**Backend**
- `models/leave-type.model.js` — `{ name: casual|sick|earned|unpaid, accrualPerMonth, maxBalance }`.
- `models/leave-balance.model.js` — `{ employee, leaveType, year, balance }`.
- `models/leave-request.model.js` — `{ employee, leaveType, fromDate, toDate, days, status: pending|approved|rejected, approvedBy }`.
- Monthly accrual: a simple scheduled job (node-cron or existing job pattern if one exists in repo — check before adding a new scheduler lib).
- Comp-off: a `leave-request` with `leaveType = comp-off`, credited via a "mark comp-off" admin action instead of a separate model.
- Encashment: endpoint that converts unused balance to a payroll input at year-end/exit (feeds into Step 4).

**Frontend**
- `hr/leave/page.tsx` — apply for leave (form) + balance summary.
- `hr/leave/approvals/page.tsx` — approver queue.
- `hr/leave/calendar/page.tsx` — team view via `@fullcalendar/react`.

**Done when:** Leave can be applied, approved, balances update automatically, calendar shows team-wide leave, encashment produces a payout figure.

---

## Step 4 — Payroll & Salary Management

**Backend**
- `models/salary-structure.model.js` — `{ employee, ctc, basic, hra, allowances[], effectiveFrom }`.
- `models/payroll-run.model.js` — `{ month, year, status: draft|processed, entries: [{ employee, payableDays, grossPay, deductions, netPay, bonus, advanceDeducted }] }`.
- `models/advance.model.js` — `{ employee, amount, reason, status, deductionSchedule }`.
- Core calculation: **one shared `calculatePayroll(employee, month, year)` function** that pulls Attendance (Step 2) + Leave (Step 3) data — called both for "preview" and "final run," never duplicated.
- Payslip PDF: one shared `generatePayslipPdf(entry)` helper.
- Bank file export: one shared `generateBankFile(payrollRun, bankFormat)` — CSV/Excel export.
- Full & final settlement: reuses `calculatePayroll` + pending leave encashment + pending expense reimbursements (Step 5).

**Frontend**
- `hr/payroll/page.tsx` — monthly payroll run screen (preview → confirm → process).
- `hr/payroll/[runId]/page.tsx` — run detail, per-employee breakdown, payslip download.
- `hr/payroll/advances/page.tsx` — advance request/approval.
- `hr/payroll/settlements/page.tsx` — full & final settlement for offboarded employees.

**Done when:** A payroll run for a month correctly reflects attendance/leave deductions, generates payslips, exports a bank file, and advances auto-deduct.

---

## Step 5 — Expense & Reimbursement

**Backend**
- `models/expense-claim.model.js` — `{ employee, category, amount, receiptUrl, status: pending|approved|rejected, approvedBy }`.
- Approved claims get pulled into the next `calculatePayroll()` run automatically (no manual re-entry) — this is the one integration point with Step 4, keep it a single lookup inside `calculatePayroll`.

**Frontend**
- `hr/expenses/page.tsx` — submit claim (receipt upload via existing upload service) + status list.
- `hr/expenses/approvals/page.tsx` — approver queue.

**Done when:** Claim submitted with receipt → approved → automatically appears as a line item in the next payroll run.

---

## Step 6 — Reports & Analytics

**Backend**
- Reuse existing data (no new models) — aggregate endpoints:
  - `GET /api/hr/reports/attendance-leave`
  - `GET /api/hr/reports/payroll-cost`
  - `GET /api/hr/reports/headcount-attrition`
- Custom report builder: keep it simple — a filter panel (department, date range, employee type) over existing endpoints with CSV export, **not** a generic query-builder engine.

**Frontend**
- `hr/reports/page.tsx` — dashboard with `apexcharts`/`react-apexcharts` (already installed), matching the style of `dashboard/analytics/page.tsx`.

**Done when:** Admin/Accounts can view and export the three report types with filters.

---

## Step 7 — Notifications & Audit Polish

- Wire key events (leave approved/rejected, payroll processed, document expiring, advance approved) into existing `notification.service.js` + `email.service.js` — no new notification system.
- Confirm every sensitive HR write (permission change, payroll run, salary structure edit) logs through the existing `audit.service.js`.
- Sidebar/menu: show HR menu items conditionally based on `HrPermission` + role, same pattern used for other admin-only menu items today.

**Done when:** Relevant actions trigger emails/in-app notifications, and audit logs show who did what.

---

## Build Order Summary

| Step | Module | Depends on |
|---|---|---|
| 0 | Permissions | — |
| 1 | Employee Management | 0 |
| 2 | Attendance | 1 |
| 3 | Leave | 1, 2 |
| 4 | Payroll | 1, 2, 3 |
| 5 | Expense & Reimbursement | 1, 4 (integration point) |
| 6 | Reports | 1–5 |
| 7 | Notifications & Audit | all |

Build strictly in this order — each step's data feeds the next, and building out of order means redoing integration work later.