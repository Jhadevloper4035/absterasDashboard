# Absteras ERP — Step-by-Step Execution Plan (No Code)

**Update:** Client and Site are now merged into one model, `Client`. Each record
represents one client/project combined — no separate Site layer for now. Every
other model (Invoice, Challan, Material Order, Expense, Payment, Ledger Entry,
Site Document) now references `Client` directly instead of carrying both a
client reference and a site reference.

If you later need one client with multiple separate projects tracked
individually, Site can be split back out — flagged at the end of this doc.

---

## STEP 1 — Client model (merged Client + Site)

**Purpose:** The single entity everything else hangs off. Represents both the
billing party and the project/site in one record.

**Fields:**
- Name (required) — e.g. "Kishori Lal Goel"
- GSTIN (optional — many clients won't have one)
- Billing address
- Shipping address
- State (needed to decide IGST vs CGST/SGST)
- State code (two-digit GST state code, e.g. "09")
- Phone number
- Email
- Site name — e.g. "Emaar Gomti Green A2-19"
- Site address
- Start date
- Status — one of: active, on hold, completed
- Estimated value (quoted/contract value)
- Notes
- Created date / updated date (automatic timestamps)

**Relationships out of this model:**
- Has many Invoices
- Has many Challans
- Has many Material Orders
- Has many Expenses
- Has many Payments
- Has many Ledger Entries
- Has many Site Documents

**Action for this step:** create the Client collection with the fields above only.

---

## STEP 2 — Item / Material master

**Purpose:** A reusable catalogue of materials so you don't retype "Aluminium Extrusion" and its HSN code every time.

**Fields:**
- Name (required) — e.g. "Aluminium Extrusion"
- HSN code — e.g. "7604"
- Default unit — e.g. NOS, SET, KG, SQFT
- Default rate (last known/standard price)
- GST rate (default 18%)
- Created date / updated date

**Action for this step:** create the Item collection and seed it with your common materials: aluminium sheet, aluminium extrusion, glass, ACP panel, hardware/fittings, etc.

---

## STEP 3 — Invoice model (Tax Invoice / revenue side)

**Purpose:** Matches your existing Tax Invoice format exactly (invoice number, GST breakup, grand total).

**Fields:**
- Invoice number (required) — e.g. "1/2026-27"
- Financial year (required) — e.g. "2026-27"
- Client reference (required)
- Invoice date (required)
- GR/RR number
- Transport
- Place of supply (state name)
- Place of supply code (two-digit)
- Reverse charge flag (yes/no)
- Vehicle number
- Station
- Line items — a list, each line item has:
  - Item reference (optional link to Item master)
  - Description (required) — e.g. "Aluminium Sheet"
  - HSN code
  - Quantity (required)
  - Unit
  - Unit price (required)
  - Line amount (required)
- Taxable amount (sum of all line amounts, required)
- IGST amount
- CGST amount
- SGST amount
- Round off
- Grand total (required)
- Status — one of: unpaid, partially paid, paid
- PDF file link (once generated)
- Created date / updated date

**Action for this step:** create the Invoice collection. Confirm invoice numbering logic separately (Step 8) before wiring this into the UI.

---

## STEP 4 — Challan model (Delivery Challan)

**Purpose:** Matches your existing Delivery Challan format (goods movement, freight, may later be linked to an invoice).

**Fields:**
- Challan number (required) — e.g. "13"
- Client reference (required)
- Challan date (required)
- Transport type
- Vehicle number
- E-way bill number
- Line items — a list, each line item has:
  - Item reference (optional)
  - Description (required)
  - HSN code
  - Quantity (required)
  - Unit
  - Rate
  - Amount
- Freight charge
- Taxable amount (required)
- GST amount
- Round off
- Total amount (required)
- Linked invoice reference (empty until this challan's goods are billed)
- PDF file link
- Created date / updated date

**Action for this step:** create the Challan collection. Decide now: can one challan later be split across multiple invoices, or is it always one challan → one invoice?

---

## STEP 5 — Material Order model (cost side — what you spend buying material)

**Purpose:** Tracks what Absteras orders and pays vendors for, per client.

**Fields:**
- Client reference (required)
- Vendor name
- Order date
- Item reference (optional)
- Description
- Quantity
- Unit
- Rate
- Amount (required)
- Status — one of: ordered, received, paid

**Action for this step:** create the Material Order collection.

---

## STEP 6 — Expense model (project-level costs)

**Purpose:** Labor, transport, fabrication, and other costs that aren't material purchases but still eat into profit.

**Fields:**
- Client reference (required)
- Category — one of: labor, transport, fabrication, misc
- Description
- Amount (required)
- Expense date (required)
- Created date / updated date

**Action for this step:** create the Expense collection.

---

## STEP 7 — Payment model (money actually received)

**Purpose:** Tracks receipts against invoices, so you can tell unpaid from paid.

**Fields:**
- Client reference (required)
- Invoice reference (required)
- Amount (required)
- Payment date (required)
- Mode — one of: bank transfer, cheque, cash, UPI
- Reference number (transaction/cheque number)

**Action for this step:** create the Payment collection. Confirm that saving a Payment also updates the linked Invoice's status field (unpaid → partially paid → paid) based on total received vs grand total.

---

## STEP 8 — Numbering Sequence model (invoice/challan auto-numbering)

**Purpose:** Guarantees invoice numbers like "1/2026-27", "2/2026-27" never duplicate, and reset correctly each financial year (April–March).

**Fields:**
- Document type — invoice or challan
- Financial year (blank if this document type doesn't reset yearly)
- Last number issued

**Action for this step:** create this collection with two starting rows: one for invoice/current financial year, one for challan. Confirm the financial-year rollover date (1 April) matches your actual billing calendar before going further.

---

## STEP 9 — Ledger Entry model (single source of truth per client)

**Purpose:** Every financial event on a project — invoice raised, payment received, material bought, expense incurred — gets one row here. This is what profit-per-client (formerly profit-per-site) is calculated from.

**Fields:**
- Client reference (required)
- Entry date (required)
- Entry type — one of: invoice, payment, material_order, expense, challan
- Reference ID (points back at whichever record caused this entry)
- Reference model name (which collection the reference ID belongs to)
- Debit amount (cost/spend — used for material orders and expenses)
- Credit amount (revenue/received — used for invoices and payments)
- Description

**Action for this step:** create the Ledger Entry collection. Decide and document the rule: which of Steps 3/5/6/7 create a debit entry, and which create a credit entry. (Standard rule: Invoice raised = credit as revenue booked; Payment received is usually tracking-only, not a second credit — confirm with your accountant before wiring in, since double-counting invoice + payment as two credits will overstate profit.)

---

## STEP 10 — Site Document model (3D designs, drawings, BOQ, estimations)

**Purpose:** Stores files against a client/project with version history.

**Fields:**
- Client reference (required)
- Document type — one of: 3D design, drawing, BOQ, estimation, other
- Title (required)
- Description
- File URL (required — where the actual file lives)
- File name (required — original uploaded filename)
- File type — e.g. PDF, DWG, SKP, RVT, XLSX
- File size (bytes)
- Version number (starts at 1, increments on re-upload)
- Supersedes reference (points at the previous version of this same document, if any)
- Is latest flag (true/false — marks the current version)
- Estimated value (only meaningful for BOQ/estimation — the headline budgeted amount)
- Uploaded by (name/ID of who uploaded it)
- Tags (free-form labels, e.g. "tower-a", "client-approved")
- Created date / updated date

**Action for this step:** create the Site Document collection. Decide now whether BOQ stays a single uploaded file with a manually entered estimated value, or becomes structured line items for automatic budget-vs-actual comparison.

---

## Execution order and dependencies

1. Client — no dependencies, do first.
2. Item — no dependencies, can be done in parallel with Client.
3. Invoice — depends on Client, Item.
4. Challan — depends on Client, Item, and optionally Invoice (for linking).
5. Material Order — depends on Client, Item.
6. Expense — depends on Client.
7. Payment — depends on Client, Invoice.
8. Numbering Sequence — needed before Invoice/Challan go live in a real workflow, no dependencies itself.
9. Ledger Entry — depends on Invoice, Payment, Material Order, Expense, Challan all existing first, since it references all of them.
10. Site Document — depends on Client only; can be built any time after Step 1.

**Recommended execution order:** 1 → 2 → 8 → 3 → 4 → 5 → 6 → 7 → 9 → 10.
(Numbering Sequence is moved up because Invoice and Challan both need it working before you can create real records.)

---

## Note on splitting Site back out later

If a client ever needs multiple independent projects tracked separately (e.g.
"Kishori Lal Goel" has both a Lucknow project and a Gurugram project, each
needing its own profit number), the fix is: re-introduce a `Site` model,
move `siteName / siteAddress / startDate / status / estimatedValue` onto it,
give it a `client` reference, and change every downstream model's `client`
reference back to a `site` reference (or keep both, denormalized, as in the
earlier version of this plan). Nothing else changes — the field lists for
Invoice/Challan/MaterialOrder/Expense/Payment/LedgerEntry/SiteDocument stay
the same, only the reference target moves.

---

## What I need from you to move to code

For each step, confirm or correct the field list above, then tell me which step number to start coding. I'll do one model at a time so you can review before the next.
