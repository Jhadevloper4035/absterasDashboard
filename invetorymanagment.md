# Inventory Management — Step-by-Step Plan
**Repo:** `absterasDashboard`

Build strictly in this order. Each step must be working end-to-end (API + UI) before the
next one starts.

---

## Ground Rules (apply to every step, no exceptions)

1. **Reuse before you build.** Before writing a new model, controller, hook, or
   component, check the repo for an equivalent (`lead.model.js`, `task.controller.js`,
   `user.routes.js`, etc.) and copy that pattern. Don't invent a new folder structure,
   naming style, or response shape.
2. **Use the library that's already installed.** Don't add a new npm package if an
   existing dependency does the job:
   - Dates/time math → `dayjs`
   - Forms + validation → `react-hook-form` + `yup`
   - Tables → `@tanstack/react-table` (via the repo's `ReactTable` wrapper) or
     `gridjs-react`, whichever the closest existing page uses
   - HTTP calls → the existing configured client (`apiFetch` in `helpers/api.ts`), not
     a raw new axios instance
   - Alerts/confirmations → `sweetalert2`
   - Toasts → `react-toastify`
   - Select/dropdowns → `react-select`
   - Calendar views → `@fullcalendar/react`
   - File uploads → existing `upload.middleware.js` + `upload.service.js`
   - Emails → existing `email.service.js`
   - PDFs → check for an existing lib first; if none, one shared `generatePdf()` helper
3. **DRY — one implementation per concern.** One shared inventory permission-check middleware, one
   `<DataTable>`/`ReactTable` wrapper reused across list pages, one stock-calculation
   function called from every place that needs it — never duplicated.
4. **Don't over-engineer.** No generic "module factory," no premature microservices, no
   config-driven dynamic form builder beyond what's actually needed. Write the direct,
   obvious version first, mirroring how the closest existing module is written today.
   Add abstraction only when the same code is about to be copy-pasted a 3rd time.
5. **Match existing conventions exactly.**
   - Backend: `routes/*.routes.js` → `controllers/*.controller.js` →
     `models/*.model.js`, wrapped in `asyncHandler`, guarded by `authenticate` +
     inventory permission middleware, mounted in `app.js`.
   - Frontend: `app/(admin)/<module>/page.tsx`, lazy-imported in `routes/index.tsx`,
     list/create/detail pages following the same file layout as the closest existing
     module.
   - Every new list endpoint supports pagination/filtering the same way the closest
     existing `list*` controller does — don't invent a different query-param scheme.
6. **One feature, one PR/step.** Fully build, test, and confirm each step below before
   starting the next.
7. **No fake/mock data left behind.** Seed/dev data goes in `seed.js`, idempotent
   (upsert-style), never hardcoded into components.

---

## Step 0 — Independent Inventory Access (prerequisite for all inventory modules)

Inventory access is separate from HR permissions, `role`, `additionalRoles`, and
`accessTypes`. Existing admin, HR, sales, operations, accounts, designer, and employee
access must not automatically expose inventory data or actions.

*Backend*
- [ ] `InventoryPermission` model — `{ user, module, access: none|view|manage, grantedBy }`
      with a unique index on `(user, module)`.
- [ ] Modules: `categories`, `items`, `transactions`, `reports`.
- [ ] `authorizeInventoryModule(module, minAccess)` middleware. Every inventory route
      uses it; it must check only `InventoryPermission`, never HR permissions or existing
      service/role access.
- [ ] `GET/PUT /api/inventory/permissions/:userId` — only the superadmin can grant or
      change inventory access. Seed an explicit `manage` permission for the superadmin
      so there is no role-based bypass.
- [ ] Audit permission changes. Remove a user's inventory permissions when the user is
      deleted.

*Frontend*
- [ ] Add an Inventory Access section to the existing user-access screen: one row per
      inventory module and None/View/Manage choices.
- [ ] Show the Inventory Management sidebar and its pages only when the current user has
      an inventory permission; do not use the current admin-only menu rule.

**Done when:** a user with no inventory permission cannot see or call any inventory
endpoint, regardless of their existing role or HR access; a user explicitly granted
View or Manage receives only that level of inventory access.

---

## Step 1 — Category Definitions
*Backend*
- [ ] `CategoryDefinition` model — `slug`, `label`, `fields[]` (`key`, `label`, `type`,
      `required`, `unit`)
- [ ] Controller: `listCategories`, `createCategory`, `updateCategory`,
      `deleteCategory` — field allowlist + audit event
- [ ] Routes: `categories` Manage for create/update/delete; View for listing
- [ ] Seed the 6 categories from the source sheet (Tube, Sheet, Profile/Section, Hand
      Rail, Bottom Rail, Hardware) with their fields

*Frontend*
- [ ] `inventory.ts` types: `CategoryField`, `CategoryDefinition`
- [ ] Admin page: table + modal to add/edit a category and its field list
- [ ] Route + sidebar entry (requires `categories` access)

**Done when:** a user with `categories` Manage can create/edit/delete categories and
their dynamic fields end-to-end, and the seeded categories appear on first run.

---

## Step 2 — Inventory Items
*Backend*
- [ ] `InventoryItem` model — common fields (`sku`, `category`, `name`, `unit`,
      `quantityInStock`, `minStockLevel`, `location`, `unitCost`, `status`) + `specs`
      as a `Map` for category-specific attributes
- [ ] `validateSpecs()` service — checks incoming `specs` against the item's
      `CategoryDefinition` before save
- [ ] Controller: `createItem`, `listItems`, `getItem`, `updateItem` — pagination +
      search, field allowlist, audit event
- [ ] Routes: `items` Manage for create/update; View for list/detail

*Frontend*
- [ ] Shared item form (react-hook-form + yup) — build the yup schema **dynamically**
      from the selected category's field list, not a static schema per category
- [ ] List page — table with category filter, search, low-stock badge
- [ ] Create page, detail/edit page
- [ ] Types, route + sidebar entry (requires `items` access)

**Done when:** items can be created/listed/edited per category, and the form renders
exactly the fields that category's definition specifies — validated client-side (yup)
and server-side (`validateSpecs`).

---

## Step 3 — Stock Transactions (ledger)
*Backend*
- [ ] `StockTransaction` model — `item`, `type` (`in`/`out`/`adjustment`), `quantity`,
      `reference`, `note`, `performedBy`
- [ ] Controller: `createTransaction` (guarded `findOneAndUpdate` + `$inc` on
      `quantityInStock`, blocking `out` transactions from going negative),
      `listTransactionsForItem`
- [ ] Routes: `GET /items/:id/transactions` requires `transactions` View; `POST`
      requires `transactions` Manage

*Frontend*
- [ ] Item detail page gets a "Stock Ledger" section — transaction table + "Adjust
      stock" modal (in/out/adjustment, quantity, reference, note)
- [ ] `sweetalert2` confirm on submit, `react-toastify` for the result

**Done when:** stock in/out is logged, `quantityInStock` updates atomically and can't
go negative, and the transaction history shows on the item detail page.

---

## Step 4 (stretch, build only after Step 3 is solid) — Low-Stock Visibility
- [ ] Dashboard widget listing items where `quantityInStock <= minStockLevel`
      (requires `reports` View)

---

## Non-goals for this first pass (don't build these)
- Barcode/QR scanning
- Supplier master or purchase-order flow
- Multi-warehouse transfer logic
- Image/file uploads on items
- Any dynamic form builder beyond the category-driven yup schema in Step 2
