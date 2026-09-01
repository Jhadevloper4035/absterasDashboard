# Laser Cut Management — Challan-Based Inventory & Wastage Tracking

**Repo:** `git@github.com:Jhadevloper4035/absterasDashboard.git`
**Stack assumed:** Node.js / Express / MongoDB (Mongoose) / Redis, React frontend — matching the existing Absteras CRM/ERP conventions (dynamic inventory categories via MongoDB Maps, module-based dashboard tabs).

This document is written to be dropped into the repo (e.g. `/docs/laser-cut-management-spec.md`) and used as context for an implementation agent (Codex / Claude Code). It defines the data model, business rules, API surface, UI, and a phased build plan for a new **"Laser Cut Management"** tab.

---

## 1. Problem Statement

Raw material (Sheets, Tubes) is sent out of central Inventory to third-party Laser Cutting vendors via a **Challan** (delivery note). Vendors don't consume 100% of what's sent in one job — leftover material stays physically at the vendor and should be tracked and reused, not silently absorbed back into central inventory. Orders define how much material is *required* in total, and may be fulfilled across multiple partial challans — the system must flag under-delivered orders until fully met. On top of this, wastage (material lost to offcuts vs. theoretical need) should be calculable, with sheet size as a configurable dimension rather than a hardcoded constant.

---

## 2. Business Rules

### 2.1 Two separate "locations" for stock

| Location | What it holds | Changes on |
|---|---|---|
| **Central Inventory** | Raw sheets/tubes owned by us, in our warehouse | `-` on Outward Challan dispatch, `+` on Inward return Challan (unused raw material sent back), `+` on new purchase/stock-in |
| **Laser Cut Stock (per vendor)** | Raw material physically sitting at a vendor, already sent but not yet consumed | `+` on Outward Challan received-at-vendor, `-` on a Usage Entry (consumption report), `-` on Inward return Challan |

These never overlap — dispatching 5 sheets doesn't just "use up" line items, it *moves* 5 sheets from one ledger to the other. This is what makes "0.5 sheets remaining after 4.5 used" show up correctly at the vendor, and not vanish or double back into central stock.

### 2.2 Laser Cut Stock is a shared, combinable pool

Keyed by `(vendor, materialType, dimensions/spec)` — **not** by challan or order. Example, sheet size 8ft × 4ft, Vendor "V1":

| Event | Pool after |
|---|---|
| Send 5 sheets (Challan OUT-1001) | 5.0 |
| Usage report: 4.5 consumed → 32 panels | 0.5 |
| *(alternate)* Usage report: only 1.5 consumed | 3.5 |
| New job needs more — send 2 more sheets (Challan OUT-1002) | 0.5 + 2 = **2.5** |
| Next usage draws from the combined 2.5 | pool decreases further |

A usage entry never needs to know *which* challan a sheet came from — it draws down the combined pool for that vendor+spec.

### 2.3 Orders track cumulative delivery, not the shared pool

An Order (e.g. **"Tolla"**) declares what it needs in total: `expectedSheets`, `expectedTubes` (+ optionally panel count/spec, for wastage). Every Challan line item linked to that order adds to the order's running totals, independent of the vendor pool math above.

```
Order "Tolla": expectedSheets = 32, expectedTubes = 14

Challan #1 (linked to Tolla): 16 sheets, 7 tubes sent
  → sentSheets = 16, sentTubes = 7
  → remainingSheets = 16, remainingTubes = 7   → STATUS: RED (short)

Challan #2 (linked to Tolla): 5 sheets, 2 tubes sent
  → sentSheets = 21, sentTubes = 9
  → remainingSheets = 11, remainingTubes = 5   → STATUS: still RED

... continues until sentSheets >= 32 AND sentTubes >= 14
  → STATUS: GREEN (fully delivered)
```

Red/green is purely a **delivery-completeness** flag, evaluated independently per material type — an order can be red on tubes and green on sheets.

### 2.4 Wastage (customizable sheet size)

Sheet dimensions are a field, not a constant — set at the InventoryItem level as a default, and overridable per Challan line (since different challans may draw from differently-sized stock). Wastage is computed per Usage Entry:

```
sheetArea      = heightFt × widthFt                (per the challan line's stored dimensions)
consumedArea   = sheetsConsumed × sheetArea
requiredArea   = panelsProduced × panelArea         (panelArea from Order or per-usage override)
wastageArea    = max(consumedArea − requiredArea, 0)
wastage%       = wastageArea / consumedArea × 100
```

If `panelArea` isn't known for a job, wastage% is simply left null/"—" rather than guessed — don't fabricate a panel spec.

### 2.5 Inventory deduction timing

Central Inventory is decremented **only when a Challan is confirmed/dispatched** (not at draft stage), so a half-filled challan form doesn't touch stock. This should be a single atomic operation (Mongo transaction) that: writes the Challan as dispatched → decrements Inventory → increments Laser Cut Stock → (if linked) increments Order totals.

---

## 3. Data Model

**Dedicated database:** all models in this section (`Order`, `Challan`, `LaserCutStock`, `UsageEntry`, `AuditLog`) live in a separate Mongo database — `absteras_lasercut` — accessed through its own Mongoose connection, isolated from the rest of the Absteras CRM. `Vendor` and `InventoryItem` stay authoritative in the main CRM database and are referenced by ID only (never duplicated as source of truth); short-lived snapshots (e.g. a vendor's address at time of dispatch) are copied onto the relevant document, as already noted for Challan. See §7 Phase 0 for the connection setup.

### 3.1 Vendor
```js
{
  _id, name, gstin, phone, email,
  address: { line1, line2, city, state, pincode },
  isActive
}
```

### 3.2 InventoryItem (extend existing schema)
```js
{
  _id, name, sku, category,           // existing fields
  materialType: 'SHEET' | 'TUBE' | 'OTHER',
  unit: 'PCS',
  defaultDimensions: {                 // customizable, not hardcoded
    heightFt: Number,                  // e.g. 8
    widthFt: Number,                   // e.g. 4  (tubes: lengthFt only)
    lengthFt: Number
  },
  quantityInStock: Number
}
```

### 3.3 Order
```js
{
  _id, orderName,                      // e.g. "Tolla"
  customerRef,
  expected: { sheets: Number, tubes: Number },
  sent:     { sheets: Number, tubes: Number },   // denormalized running total
  panelSpec: { count: Number, panelAreaSqFt: Number }, // optional, for wastage
  status: 'PENDING' | 'PARTIAL' | 'COMPLETE',    // derived: RED if sent < expected on either axis
  createdAt
}
```

### 3.4 Challan
```js
{
  _id, challanNo,                      // auto-generated, sequential
  type: 'OUT' | 'IN',                  // OUT: inventory→vendor, IN: vendor→inventory
  vendorRef,
  vendorAddressSnapshot,               // copied at creation time, so it doesn't drift if vendor address changes later
  orderRef,                            // optional — links dispatch to an Order for red/green tracking
  items: [{
    inventoryItemRef,
    materialType: 'SHEET' | 'TUBE',
    quantity: Number,                  // supports decimals: 4.5, 0.5, etc.
    dimensions: { heightFt, widthFt, lengthFt },  // overridable per line
  }],
  status: 'DRAFT' | 'DISPATCHED' | 'RECEIVED',
  dispatchedAt, createdBy
}
```

### 3.5 LaserCutStock (the vendor-side pool)
```js
{
  _id,
  vendorRef,
  materialKey: String,                 // derived: `${materialType}-${heightFt}x${widthFt}` etc.
  materialType: 'SHEET' | 'TUBE',
  dimensions: { heightFt, widthFt, lengthFt },
  quantityAvailable: Number,           // running balance for this vendor+spec
  updatedAt
}
// unique index on { vendorRef, materialKey }
```

### 3.6 UsageEntry (consumption report from/about the vendor)
```js
{
  _id,
  vendorRef,
  orderRef,                            // which job this consumption was for
  materialType, dimensions,
  quantityConsumed: Number,            // e.g. 4.5
  panelsProduced: Number,              // e.g. 32
  wastageAreaSqFt: Number,             // computed, stored for reporting
  wastagePercent: Number,
  reportedAt
}
```

### 3.7 AuditLog (the "record everything" ledger)
```js
{
  _id,
  entityType: 'CHALLAN' | 'ORDER' | 'LASER_CUT_STOCK' | 'USAGE_ENTRY' | 'VENDOR',
  entityId,
  action: 'CREATE' | 'DISPATCH' | 'RECEIVE' | 'USAGE_REPORTED' | 'UPDATE' | 'DELETE',
  performedBy,          // userId
  before: Object,       // full snapshot pre-change, null on create
  after: Object,        // full snapshot post-change
  metadata: Object,     // e.g. { challanNo, vendorName } — denormalized for fast search without a join
  createdAt
}
// indexes: { entityType, entityId, createdAt }  and  { performedBy, createdAt }
```
Every mutating call in §7 Phase 3 writes one of these alongside its state change, in the same transaction — so nothing changes in this module without leaving a permanent, queryable trail of who did what and what the values were before/after.

---

## 4. Core Formulas (reference)

```
sheetArea(dim)        = dim.heightFt * dim.widthFt

// on Outward Challan dispatch, per line item:
Inventory.quantityInStock       -= item.quantity
LaserCutStock.quantityAvailable += item.quantity        (upsert by vendor+materialKey)
if (challan.orderRef) {
  Order.sent[materialType]      += item.quantity
}

// on Usage Entry:
LaserCutStock.quantityAvailable -= usage.quantityConsumed   (floor at 0; reject if it would go negative)
consumedArea   = usage.quantityConsumed * sheetArea(usage.dimensions)
requiredArea   = usage.panelsProduced * order.panelSpec.panelAreaSqFt
wastageArea    = max(consumedArea - requiredArea, 0)
wastagePercent = wastageArea / consumedArea * 100

// order status (recomputed on every linked challan write):
remainingSheets = max(order.expected.sheets - order.sent.sheets, 0)
remainingTubes  = max(order.expected.tubes  - order.sent.tubes, 0)
order.status = (remainingSheets > 0 || remainingTubes > 0) ? 'PARTIAL' : 'COMPLETE'
// UI renders remainingSheets/remainingTubes in red whenever > 0, regardless of how many challans it took
```

---

## 5. API Endpoints

```
Vendors
  GET    /api/vendors
  POST   /api/vendors
  PATCH  /api/vendors/:id

Orders
  GET    /api/orders
  POST   /api/orders                       { orderName, expected:{sheets,tubes}, panelSpec }
  GET    /api/orders/:id                   → includes computed remaining + status + linked challans
  PATCH  /api/orders/:id

Challans
  GET    /api/challans?type=OUT&vendor=&order=
  POST   /api/challans                     status: 'DRAFT'
  POST   /api/challans/:id/dispatch        → atomic: deduct Inventory, credit LaserCutStock, update Order.sent
  POST   /api/challans/:id/receive         (type=IN: credit Inventory, debit LaserCutStock)
  GET    /api/challans/:id/print           → challan PDF (vendor address, items, order ref)

Laser Cut Stock (vendor pool)
  GET    /api/laser-cut-stock?vendor=      → current balances per vendor+material spec

Usage Entries
  POST   /api/usage-entries                { vendorRef, orderRef, materialType, dimensions, quantityConsumed, panelsProduced }
                                            → atomic: debit LaserCutStock, compute + store wastage
  GET    /api/usage-entries?order=

Audit
  GET    /api/laser-cut-management/audit?entityType=&entityId=   → full change history for any order/challan/vendor pool

Dashboard
  GET    /api/laser-cut-management/summary → one-call payload for the tab (see §6)
```

All dispatch/receive/usage mutations should run inside a Mongo session/transaction — they touch 2–3 collections and must not partially apply.

---

## 6. Frontend — "Laser Cut Management" Tab

Single page, three sections, matching the existing dashboard tab pattern:

**A. Orders table** (the red/green view)
| Order | Expected Sheets | Sent Sheets | Remaining Sheets | Expected Tubes | Sent Tubes | Remaining Tubes | Panels (done/expected) | Status | Actions |
|---|---|---|---|---|---|---|---|---|---|
| Tolla | 32 | 21 | **11** (red) | 14 | 9 | **5** (red) | 32 / 40 | Partial | View / New Challan |

- Any `Remaining > 0` cell renders in red; `0` renders in green/neutral.
- Row expands to show all linked challans (in + out) for that order.

**B. Laser Cut Stock (vendor pool) table**
| Vendor | Material | Spec (H×W or L) | Qty Available |
|---|---|---|---|
| V1 | Sheet | 8ft × 4ft | 2.5 |
| V1 | Tube | 6ft | 4 |

This is the "what's sitting unconsumed at the vendor right now" view — independent of any single order.

**C. Challan register**
All In/Out challans, filterable by vendor/order/type/date, each linking out to: vendor, inventory item(s), and (if set) the order. "Create Challan" button opens a form with a sheet/tube size field that defaults from the InventoryItem but is editable per line (this is the customizable-sheet-size requirement).

---

## 7. Step-by-Step Implementation Plan

**Phase 0 — Provision the dedicated database**
1. Create a new Mongo database on the existing cluster: `absteras_lasercut` (same deployment/replica set as the main CRM DB — this matters for transactions, see step 9).
2. Add a second Mongoose connection in the backend, e.g. `db/lasercutConnection.js`, using `mongoose.createConnection(process.env.LASERCUT_MONGO_URI)` — kept separate from the default/CRM connection.
3. Add `LASERCUT_MONGO_URI` to env config (can point at the same host, different db name — `.../absteras_lasercut`).

**Phase 1 — Schemas, including the audit log**
4. Define `Order`, `Challan`, `LaserCutStock`, `UsageEntry`, and `AuditLog` (§3.7) as models on the `lasercutConnection` — not the default mongoose connection.
5. Extend the existing `InventoryItem` schema (still in the main CRM DB) with `materialType` + `defaultDimensions`.
6. Write a migration/seed to backfill `defaultDimensions` on existing sheet/tube inventory items.
7. Add indexes on `AuditLog`: `{entityType, entityId, createdAt}` and `{performedBy, createdAt}`.

**Phase 2 — Reference resolution across the two databases**
8. Build `refs.service.js` in the lasercut module: thin lookups that fetch `Vendor`/`InventoryItem` details from the main CRM connection by ID (no cross-connection `.populate()` — Mongoose can't join across separate connections). Snapshot anything that needs to survive source-record changes (e.g. vendor address) directly onto the Challan document, as already speced in §3.4.

**Phase 3 — Transactional writes + audit logging**
9. Confirm both connections point at the same MongoDB deployment/replica set — if so, a single `session` from either connection's underlying client can wrap writes across both databases atomically (`mongoose.startSession()` supports cross-database transactions within one deployment since MongoDB 4.2+). If the two DBs will ever live on genuinely separate clusters, flag this now — atomic cross-cluster writes aren't possible, and you'd need a compensating-transaction (saga) pattern instead.
10. Build `challanDispatch.service.js` — inside one session: (a) decrement `InventoryItem.quantityInStock` (CRM DB), (b) upsert `LaserCutStock` (lasercut DB), (c) increment `Order.sent` (lasercut DB), (d) write an `AuditLog` entry for each state change. Commit together; abort entirely on any failure.
11. Build `usageEntry.service.js` the same way — debit `LaserCutStock`, compute wastage, write `AuditLog`.
12. Build `challanReceive.service.js` for IN challans — credit `InventoryItem` or finished-goods stock, debit `LaserCutStock` if it's a raw-material return, write `AuditLog`.

**Phase 4 — API surface**
13. Vendor CRUD, Order CRUD, Challan list/filter/dispatch/receive, LaserCutStock read, UsageEntry create/list.
14. `GET /laser-cut-management/audit?entityType=&entityId=` — full change history for any order, challan, or vendor pool.
15. `GET /laser-cut-management/summary` — single aggregation call for the dashboard tab.

**Phase 5 — Frontend**
16. New "Laser Cut Management" tab/route in the dashboard nav.
17. Orders table with red/green remaining cells (§6.A).
18. Vendor stock pool table (§6.B).
19. Challan register + create-challan form with editable per-line dimensions (§6.C).
20. Challan print/PDF view with vendor address snapshot.
21. A "History" panel on each order/challan/vendor-pool view, reading from the audit endpoint (step 14) as a timeline — who dispatched, who reported usage, exactly what changed, when.

**Phase 6 — Wastage reporting**
22. Usage entry form (vendor consumption report).
23. Wastage % surfaced per order and as a vendor-level rollup/report.

**Phase 7 — Backup, retention, hardening**
24. Separate backup schedule for `absteras_lasercut` (its own `mongodump` cron or Atlas backup policy) — trivial to isolate since it's its own database.
25. Default to keeping `AuditLog` indefinitely, since it's the record-of-truth this feature exists to provide; only consider archival/TTL later if volume genuinely becomes a storage problem.
26. Role/permission checks on who can dispatch, receive, and report usage — tie into existing Absteras auth; `AuditLog.performedBy` should always be populated regardless of role.
27. Integration tests asserting every dispatch/receive/usage call produces a matching `AuditLog` row with correct before/after snapshots.

---

## 8. Edge Cases & Validation

- **Partial-decimal quantities** (4.5, 0.5, 1.5) — use `Number` with 2-decimal rounding, not integers, throughout.
- **Over-delivery**: if cumulative sent exceeds expected, clamp `remaining` at 0 rather than showing negative; consider a separate "over-delivered" badge if that matters to you.
- **Usage without enough pool balance**: reject, or require an explicit override — decide based on whether vendors sometimes report more consumption than was formally dispatched (common in practice; if so, allow it but flag the entry for review).
- **Order with no linked panel spec**: wastage% shows "—", not a fabricated number.
- **Returned/unused raw material** (IN challan of raw sheets, not finished panels) should debit LaserCutStock and credit central Inventory — distinct from an IN challan of finished panels, which credits a *finished-goods* SKU instead and does not touch LaserCutStock.

---

## 9. Suggested File Structure

```
/db
  lasercutConnection.js          // dedicated Mongoose connection → absteras_lasercut
/models
  /lasercut                      // registered on lasercutConnection
    Order.js
    Challan.js
    LaserCutStock.js
    UsageEntry.js
    AuditLog.js
  // Vendor.js and InventoryItem.js remain in the main CRM models directory —
  // referenced by ID from the lasercut module, not duplicated
/routes
  vendors.routes.js
  orders.routes.js
  challans.routes.js
  laserCutStock.routes.js
  usageEntries.routes.js
  laserCutAudit.routes.js        // GET /laser-cut-management/audit
  laserCutManagement.routes.js   // summary/dashboard endpoint
/services
  refs.service.js                // cross-DB lookups for Vendor/InventoryItem
  challanDispatch.service.js     // transactional dispatch logic (§7 Phase 3)
  challanReceive.service.js
  usageEntry.service.js
  wastage.service.js
  audit.service.js               // writeAuditLog() helper used by all of the above
/frontend/pages/LaserCutManagement
  OrdersTable.jsx
  VendorStockTable.jsx
  ChallanRegister.jsx
  CreateChallanForm.jsx
  UsageEntryForm.jsx
  HistoryPanel.jsx                // renders AuditLog timeline for an order/challan/pool
```