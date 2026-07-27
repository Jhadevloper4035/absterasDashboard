Library
/
CODEX_PROJECT_CONTEXT.md

Sales CRM - Codex Project Context
1. Purpose of this document
This file is the primary implementation context for Codex and human developers working on the Sales CRM. Read it before planning or changing the project.

The system receives leads from multiple sources, assigns every lead to an accountable salesperson, tracks its status and activities until conversion or closure, manages client meetings, sends reminders to the salesperson, and stores the Minutes of Meeting (MOM) as part of the lead's permanent history.

If repository code, an approved ADR, or an approved business requirement conflicts with this document, do not silently choose one. Report the conflict and request a decision.

2. Product goals
Create a single source of truth for leads from all approved sources.

Ensure every active lead has an owner and a next action.

Make assignment, reassignment, status changes and communication traceable.

Reduce missed meetings with in-app/mobile and WhatsApp reminders.

Let every salesperson see today's meetings in their local timezone.

Capture every meeting outcome and MOM without losing history.

Give managers visibility into the pipeline, overdue work, SLA and conversion.

Protect lead data using role-based and record-level permissions.

3. MVP scope
Included
Authentication, session management, users, teams, roles and permissions.

Lead sources, manual creation, CSV import and a standard lead intake API.

Up to three explicitly approved external source integrations for the initial release.

Lead validation, normalization and duplicate detection.

Manual and rule-based assignment/reassignment with assignment history.

Configurable lead pipeline, status history and mandatory business rules.

Lead timeline containing notes, calls, follow-ups, meetings, MOMs and attachments.

Follow-up queues, overdue work and next-action enforcement.

Meeting creation, rescheduling, cancellation, completion and no-show outcomes.

Personal calendar and today's meeting schedule.

One-hour meeting reminder.

Configurable morning WhatsApp schedule for each salesperson.

MOM, action items, attachments, next follow-up and MOM edit history.

Won/lost handling and conversion into customer/contact and deal records.

Salesperson and manager dashboards, filters and essential exports.

Audit logs, logging, monitoring, backups and background-job operations.

Deferred unless separately approved
Native Android/iOS applications. Start with a responsive PWA.

AI lead scoring, AI-generated MOM or automated sales recommendations.

Telephony, call recording and full marketing automation.

Commission calculation.

Customer self-service portal.

Complex ERP, accounting or order-management integrations.

Unlimited or unnamed lead-source connectors.

4. Users and authorization
Admin
Manage users, roles, teams, territories and configuration.

Configure sources, pipeline stages, assignment rules and notification templates.

View data permitted by organization policy.

View audit and operational logs.

Sales Manager
View authorized team leads, meetings, MOMs, follow-ups and reports.

Assign and reassign leads.

Review assignment exceptions, overdue activity and MOM compliance.

Salesperson
View and act on assigned or explicitly shared leads.

Accept/reject a lead where enabled.

Update status, activities, follow-ups and meeting information.

Create MOM and action items.

View personal schedule and notifications.

Management Viewer
Read-only access to specifically approved dashboards and records.

Authorization rules
Enforce permissions in the backend; hiding UI controls is not authorization.

Apply both role-level and record-level checks.

Users must not see another salesperson's records unless team/territory/sharing rules permit it.

Internal MOM notes may require stricter field-level permission.

Audit sensitive reads/exports and all mutations defined in the audit policy.

5. Canonical lead lifecycle
Default stages:

NEW
-> ASSIGNED
-> ACCEPTED
-> CONTACT_ATTEMPTED
-> CONTACTED
-> QUALIFIED
-> MEETING_SCHEDULED
-> PROPOSAL_SENT
-> NEGOTIATION
-> WON | LOST | ON_HOLD
Stages must be configurable. Stable internal codes should be used; display labels may change.

Rules:

Every lead must have a source.

Every active lead must have an owner or be visible in an assignment-exception queue.

Every active contacted lead should have a next action when policy requires it.

Rejection, lost and on-hold transitions require configured reasons.

Only authorized users can reopen a closed lead.

Status history is append-only.

"Matured lead" must be confirmed during Discovery. Baseline interpretation: WON or formally closed as LOST.

6. Lead capture and duplicate handling
Supported entry patterns:

Manual form.

CSV import with preview, validation and reconciliation.

Standard authenticated intake API.

Approved source-specific webhook/connectors.

Normalize before matching:

Phone numbers into E.164 where country context is known.

Email casing and whitespace.

Source/campaign/product identifiers.

Dates and timezones.

Duplicate strategy is configurable:

Match normalized phone.

Match normalized email.

Optionally apply approved business identifiers.

Send uncertain matches to a human review queue.

Never silently merge records.

Keep an audit trail of link, merge, ignore or reject decisions.

Webhook intake must support signature verification, idempotency keys, replay protection and safe retry behavior.

7. Assignment engine
Supported policies:

Manual.

Round robin.

Source/campaign.

Product/service.

Territory/location.

Team and workload.

Evaluation requirements:

Rules have explicit priority and deterministic results.

Exclude inactive users.

Exclude absent users when leave integration/configuration is enabled.

Enforce capacity rules if configured.

If no rule succeeds, place the lead in an exception queue and notify the responsible manager.

Store previous owner, new owner, reason, rule, actor and timestamp.

Reassignment cancels or transfers owner-specific pending actions according to approved business rules.

Do not bury assignment logic inside controllers. Implement it as a testable domain service.

8. Activity timeline and follow-ups
The lead detail screen presents a chronological timeline containing:

Creation and source information.

Assignment/reassignment.

Status changes.

Calls, notes, email/WhatsApp metadata where integrated.

Follow-ups and completion.

Meetings and meeting lifecycle changes.

MOM and MOM versions.

Attachments.

Conversion/loss.

Timeline events should be append-only projections from authoritative records. Avoid storing editable HTML as the only representation.

Follow-up fields:

Lead, assigned user, type, due timestamp, timezone context, priority and notes.

Status: pending, completed, skipped or cancelled.

Completion timestamp and actor.

Reminder policy.

Provide queues for due today, overdue, upcoming, no next action and inactive leads.

9. Meetings
Required fields:

Lead/client.

Owner and attendees.

Title and agenda.

Type: phone, online or in-person.

Address or meeting URL.

Start timestamp stored in UTC plus the relevant IANA timezone.

Duration/end timestamp.

Status and outcome.

Reminder preferences.

Meeting statuses:

SCHEDULED
CONFIRMED
COMPLETED
RESCHEDULED
CANCELLED
CLIENT_NO_SHOW
SALESPERSON_NO_SHOW
Rules:

Warn about overlapping meetings for the salesperson.

A reschedule keeps history and creates a new effective schedule.

Cancelling/rescheduling must invalidate superseded reminder jobs.

Completed meetings enter MOM_PENDING when MOM is required.

Today's schedule is calculated in the user's configured IANA timezone.

Do not use server-local time for business decisions.

10. MOM - Minutes of Meeting
Required capabilities:

Discussion summary.

Client requirements.

Questions and objections.

Decisions.

Outcome.

Products/services discussed.

Budget and expected closure date where relevant.

Action items with owner and due date.

Next follow-up or next meeting.

Recommended lead status.

Attachments.

Internal/private notes with permission control.

MOM records must not be destructively overwritten. Use versions or an append-only change record with current projection. Managers need a queue for missing/overdue MOMs.

11. Notifications and background jobs
Channels:

In-app notification.

Web/mobile push if enabled.

WhatsApp.

Optional SMS/email fallback only after approval.

Meeting reminder behavior:

On meeting creation, schedule a job for one hour before start.

If the meeting begins in less than one hour, apply the approved immediate-reminder rule.

On reschedule, invalidate the old job and schedule the new one.

On cancellation, invalidate the job.

Before sending, reload the meeting and confirm it is active, unchanged and owned by the intended recipient.

Use an idempotency key so retries cannot create duplicate messages.

Store attempted, sent, delivered, read and failed states where supported.

Morning schedule:

Default proposal: 8:00 AM in each user's timezone, configurable per user.

Include today's meetings ordered by time.

Optionally include overdue follow-ups and MOM pending.

Support a no-meetings variant.

Respect notification preferences, consent and opt-out rules.

Use durable business records as the source of truth. Redis/BullMQ is for job execution, caching and locks, not permanent meeting or notification history.

Add a reconciliation worker that finds meetings whose expected reminder is missing or stuck.

12. WhatsApp integration
Use Meta WhatsApp Cloud API or an approved Business Solution Provider.

Required controls:

Verified business account and sender number.

Approved business-initiated message templates.

Secure credential storage.

Webhook signature verification.

Delivery status processing.

Template version/governance.

Consent and opt-out handling.

Minimal personal data in message bodies.

Secure deep links, not raw sensitive details.

Retry only retryable failures; do not endlessly retry permanent rejection.

The CRM must remain usable if WhatsApp is unavailable.

13. Conversion and closure
On WON:

Create or link a customer/contact.

Create a deal/opportunity if in the approved MVP.

Record deal value, product/service, close date and salesperson credit.

Preserve the complete lead timeline.

Ensure conversion is idempotent.

On LOST:

Require a configured loss reason and comment.

Optionally record competitor and re-engagement date.

Permit reopen only with authorization and audit.

14. Suggested technical architecture
Use this baseline unless the repository already contains an approved alternative:

Frontend: Next.js/React with TypeScript, responsive PWA.

API: Node.js with NestJS and TypeScript.

Database: PostgreSQL.

ORM/migrations: Prisma.

Cache/jobs: Redis and BullMQ.

Realtime/in-app updates: WebSocket/Socket.IO only where justified.

Attachments: S3-compatible object storage with signed access.

API contract: OpenAPI/Swagger.

Authentication: short-lived access token plus rotating refresh token.

Testing: Jest, SuperTest and Playwright.

Delivery: Docker, CI/CD, staging and production environments.

Observability: structured logs, metrics, traces where useful, health and readiness checks.

Start as a modular monolith:

apps/
  web/
  api/
  worker/
packages/
  domain/
  database/
  contracts/
  ui/
  config/
Suggested backend modules:

auth
users
teams
permissions
leads
lead-sources
assignment
activities
follow-ups
meetings
moms
notifications
whatsapp
customers
deals
reports
files
audit
health
Keep controllers thin. Business rules belong in application/domain services. External providers must be behind interfaces/adapters.

15. Core database entities
users, roles, permissions, user_roles

teams, team_members, territories

leads, lead_sources, campaigns

lead_assignments

lead_stages, lead_status_history

activities, follow_ups

meetings, meeting_attendees, meeting_history

meeting_moms, mom_versions, mom_action_items

notifications, notification_deliveries, notification_preferences

customers, contacts, deals

attachments

audit_logs

integration_events or webhook_receipts

outbox_events

Implementation guidance:

Use UUID/ULID identifiers according to the repository convention.

Use created_at, updated_at and actor fields consistently.

Store timestamps in UTC and retain IANA timezone context where business display/scheduling needs it.

Use optimistic concurrency/version columns where conflicting edits matter.

Prefer soft deletion or deactivation for business records; define retention before physical deletion.

Use an outbox pattern for business events that must reliably trigger asynchronous work.

16. Initial API surface
Representative routes; final naming comes from the approved API standard:

POST   /auth/login
POST   /auth/refresh
POST   /auth/logout

GET    /users/me
GET    /users/me/schedule/today

POST   /leads
POST   /leads/intake
POST   /leads/imports
GET    /leads
GET    /leads/:id
PATCH  /leads/:id
POST   /leads/:id/assign
POST   /leads/:id/status
POST   /leads/:id/activities
POST   /leads/:id/follow-ups
POST   /leads/:id/convert

POST   /meetings
GET    /meetings
GET    /meetings/:id
PATCH  /meetings/:id
POST   /meetings/:id/reschedule
POST   /meetings/:id/cancel
POST   /meetings/:id/complete
POST   /meetings/:id/mom
GET    /meetings/:id/moms

GET    /notifications
PATCH  /notifications/:id/read
POST   /webhooks/whatsapp

GET    /reports/pipeline
GET    /reports/activities
GET    /reports/meetings
Use request validation, consistent error envelopes, pagination, filter allowlists, permission checks and idempotency keys for appropriate POST operations.

17. Security baseline
Hash passwords with a current memory-hard algorithm.

Rotate refresh tokens and detect reuse.

Support session revocation.

Apply rate limiting to authentication, intake and webhooks.

Validate all input at the boundary.

Protect against SQL injection, XSS, CSRF where relevant, SSRF and insecure file upload.

Verify webhook signatures and timestamp tolerance.

Store secrets outside code and logs.

Encrypt data in transit; apply encryption at rest according to hosting policy.

Use signed, short-lived attachment URLs.

Sanitize spreadsheet exports against formula injection.

Avoid logging message bodies, tokens or unnecessary personal data.

Audit login-sensitive events, assignment, status, MOM edit, export, configuration and deletion.

Back up the database and verify restoration.

18. Testing requirements
Unit tests
Assignment priority, exclusion and round-robin behavior.

Lead-stage transition rules.

Duplicate normalization/matching.

Meeting reminder timestamp calculation.

Timezone and morning-summary selection.

Idempotency and retry classification.

Conversion and loss rules.

Integration tests
Authentication and authorization boundaries.

Lead intake to assignment.

Status/timeline persistence.

Meeting create/reschedule/cancel and job lifecycle.

MOM creation/versioning.

Outbox to worker processing.

WhatsApp webhook verification and delivery update.

End-to-end tests
New lead through won conversion.

Duplicate lead review.

Manager reassignment.

Today's meetings for a salesperson.

One-hour reminder and no duplicate on retry.

Cancelled meeting receives no reminder.

Completed meeting enters MOM Pending and exits after MOM.

Unauthorized salesperson cannot read another user's lead.

Every defect fix should include a regression test where practical.

19. Observability and operations
Monitor:

API latency and error rate.

Authentication failures and rate-limit events.

Unassigned lead count and assignment age.

Queue depth, job latency, retries and dead-letter failures.

Meeting reminders expected vs sent.

WhatsApp delivery/failure rate.

Overdue follow-ups and MOM.

Database, Redis and object-storage health.

Define alerts with an owner and runbook. A log line is not an operational strategy.

20. Recommended implementation sequence
Phase 0 - Discovery
Confirm roles and record visibility.

Define matured lead, pipeline and transition rules.

Name priority lead sources.

Define assignment hierarchy and leave/capacity behavior.

Confirm SLA, follow-up and escalation rules.

Confirm WhatsApp provider, account and templates.

Confirm data volume, migration and compliance.

Approve wireframes, backlog and non-functional targets.

Phase 1 - Foundation
Initialize monorepo and local development.

Add PostgreSQL, Redis and worker.

Add configuration validation and secrets template.

Implement auth, users, roles, teams and permissions.

Add migrations, seed data, OpenAPI, logs, health and CI.

Phase 2 - Leads
Implement lead/source/stage models.

Add manual and API intake.

Add normalization and duplicate workflow.

Add assignment service and exception queue.

Add status transitions and history.

Add timeline, follow-ups, filters and search.

Phase 3 - Meetings and MOM
Implement meetings and attendees.

Add calendar and today's schedule.

Add lifecycle/history and conflict warning.

Add MOM, MOM versions and action items.

Add MOM Pending and overdue queues.

Phase 4 - Notifications
Add outbox and worker processing.

Add in-app notifications.

Add one-hour reminder with reconciliation.

Add morning schedule.

Integrate WhatsApp templates and delivery webhooks.

Add retries, failure dashboard and approved fallback.

Phase 5 - Conversion and reports
Add customer/contact and deal.

Add won/lost/reopen.

Add salesperson and manager dashboards.

Add operational reports and protected exports.

Phase 6 - Release
Run regression, security, performance and recovery testing.

Rehearse migration.

Complete UAT.

Prepare production, monitoring and runbooks.

Train users, launch and conduct hypercare.

21. Local development target
Codex should create or preserve a reproducible setup similar to:

cp .env.example .env
docker compose up -d postgres redis
npm install
npm run db:migrate
npm run db:seed
npm run dev
Expected commands:

npm run lint
npm run typecheck
npm test
npm run test:integration
npm run test:e2e
npm run build
The actual package manager and commands must follow the repository once initialized. Do not introduce a second package manager.

22. Codex working instructions
When asked to implement:

Inspect the repository, AGENTS.md, package scripts, migrations and tests first.

State the affected module and acceptance criteria.

Implement the smallest complete vertical slice.

Preserve unrelated user changes.

Add or update tests.

Run relevant lint, typecheck, tests and build.

Report files changed, verification completed and remaining decisions.

Do not:

Invent unapproved business rules.

Treat Redis as the source of truth.

Perform notification sends inside the user-facing API transaction.

Use server-local time for schedules.

Overwrite status, assignment or MOM history.

bypass backend authorization because the frontend hides a feature.

Log credentials, tokens, full message content or unnecessary personal data.

Add microservices without a demonstrated boundary and operational need.

Claim a provider message was delivered when only the API request was accepted.

23. Open decisions - must be resolved
Company/project name and branding.

Exact matured-lead definition.

Final lead stages and transition permissions.

Initial lead sources and connector specifications.

Assignment priority and salesperson absence/capacity behavior.

Duplicate match/merge policy.

First-response SLA and escalation recipients.

Which users may view all leads, meetings and private MOM notes.

Client reminders in addition to salesperson reminders.

Morning summary default time and fallback channels.

WhatsApp provider, templates, consent and opt-out.

Calendar synchronization with Google/Outlook.

MOM approval/edit rules.

Customer/deal/order fields after conversion.

Hosting environment, region and compliance constraints.

Expected load, availability, recovery and retention targets.

Historical data migration scope.

Track these as explicit decision records. Until approved, implement configurable interfaces or safe defaults without hard-coding policy.

24. Definition of done
A story is done only when:

Acceptance criteria pass.

Backend authorization is enforced.

Validation and error behavior are implemented.

Database changes have safe migrations.

Audit/observability is included where required.

Tests cover core success and failure paths.

API documentation is updated.

No critical/high security issue is open.

Relevant checks pass in CI.

Product Owner accepts the demonstrated behavior.