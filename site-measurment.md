## Designer Section — Functional Plan for Absteras CRM

Fits alongside your existing role-based modules (similar audit/version pattern to how Laser Cut Management tracks challans in/out — every action gets a record, every status change is timestamped and attributable to a user).

### 1. New Role: Designer

A distinct role in the CRM, same tier as your existing roles (Admin, Sales, etc.). Designer's nav only shows the Designer section; Admin sees the Designer section **plus** the internal tracking/review pages for it.

### 2. Navigation Structure

```
Designer (main menu)
 ├── BOQ
 ├── Site Measurement
 ├── Drawing
 └── Production Data
```

Each submenu opens the same first step: pick **Client** → pick **Client Address** (a client can have multiple site addresses, so this selector drives everything downstream).

---

### 3. BOQ — Approval Cycle Module

**Designer side:**
- Select client + address
- Upload BOQ file
- Submits it, status becomes "Pending Review"
- If admin sends it back, designer sees the comment/reason, edits, re-uploads — this creates a new version under the same BOQ record (not a new record)
- Cycle repeats until Admin approves

**Admin side (internal tracking page):**
- One table of every BOQ ever submitted, filterable by client, address, designer, status
- Per BOQ: current status, version number, who uploaded last, when
- Action buttons: Approve / Request Revision (with a comment field) / Reject
- History drawer per BOQ showing the full version-by-version timeline (upload → review → comment → next upload...)
- Summary counters at the top: total BOQs created, approved, in revision, rejected — this is your "how many BOQs have we made" number

**Status flow:** Pending Review → (Revision Requested → back to Pending Review on re-upload) → Approved, or → Rejected (closed, doesn't loop).

---

### 4. Site Measurement — Running Log Module

No approval cycle here — this is just a growing record per client address.

**Designer side:**
- Select client + address
- Upload an entry: title, description, and files (photos and/or PDFs)
- Can add as many entries as needed for the same address over time (e.g. multiple site visits)

**Internal page:**
- Table of all site measurement entries, filterable by client/address/designer/date
- Each row expandable to see the photos/PDF/description for that entry
- No status field needed — it's a log, not a workflow

---

### 5. Drawing — Approval Cycle Module

Structurally identical to BOQ, with two differences:
- Multiple files per submission (a drawing set, not a single file)
- Otherwise same version history, same revision/reject/approve cycle, same admin tracking table and counters

---

### 6. Production Data — Gated, One-Per-Address Module

**Unlock condition** (checked before the designer can even open the "create" form for a given client address):
- BOQ status = Approved, **and**
- Drawing status = Approved, **and**
- At least one Site Measurement entry exists

If any condition isn't met, the UI shows which piece is missing instead of the form (e.g. "Waiting on Drawing approval").

**Designer side (once unlocked):**
- Create one Production Data record for that client address
- Attach multiple files of mixed types (Excel, PSD, PDF, etc.)
- Add the coding/numbering plan for that production run
- Unlike BOQ/Drawing, this is **not versioned or re-approved** — it's a single record per client address, updatable but not cycled through admin review (unless you actually want an approval step here too — you didn't mention one, so I left it out)

**Internal page:**
- Table of all Production Data entries: client, address, files attached, created by, date
- One entry per client-address enforced at creation (can't create a second one for the same address — would need to edit the existing one instead)

---

### 7. Cross-Cutting Pieces

- **Permissions:** Designers can create/upload in all four modules but can't approve/reject their own BOQ or Drawing. Admin approves/reviews and sees all tracking tables; Admin should also see Site Measurement and Production Data tables even without an approval role there, just for visibility.
- **Audit trail:** Every upload and every status change stores who did it and when — this is what powers your counters and history views, and matches the challan-style tracking you're already using elsewhere in the CRM.
- **Client-address as the anchor:** All four modules key off the same (client, address) pair, so eventually you could have a single "Client Address Overview" page showing BOQ status, Drawing status, Site Measurement count, and Production Data status side by side for that one address — useful as a dashboard, even if not in your original ask.

Let me know if the approval states, the Production Data gating, or the permission split needs adjusting — once it's locked in, I can move to the models/routes/UI.