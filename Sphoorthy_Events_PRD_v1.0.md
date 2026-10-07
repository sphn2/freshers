# SPHOORTHY EVENTS — Enterprise Event Registration, Ticketing & Validation Platform

## Antigravity Build Specification — PRD v1.0

### Executive Summary
Build an enterprise-grade event registration, payment, ticketing, gate-entry and food-validation platform for Sphoorthy Engineering College. The platform supports online registrations, offline cash registrations, Razorpay payments, HTML email tickets, QR scanning, manual 6-digit ticket-code fallback, one-time gate validation, one-time food validation, organizer/coordinator dashboards, reporting, audit logs and transactional email notifications.

### Core Stack
- Frontend: Next.js + TypeScript + Tailwind CSS
- Backend: Python Flask REST API
- Database: Supabase PostgreSQL
- Authentication: Supabase Auth
- Authorization: RBAC + appropriate PostgreSQL RLS
- Payments: Razorpay Orders + Checkout + server-side verification + webhooks
- Email: Google Workspace/Gmail SMTP
- Storage: Supabase Storage
- Deployment: Vercel
- Validation: Pydantic
- Testing: Pytest

### Critical Product Rule
Every ticket has:
1. A secure QR token for fast scanning.
2. An exactly 6-digit numeric human-readable Ticket Code for camera failure/manual entry.

The 6-digit code is unique per event using `UNIQUE(event_id, ticket_code)`. Internal records use UUIDs. Do not use the 6-digit code as the primary key.

### Roles
- ADMIN
- EVENT_MANAGER / COORDINATOR
- OFFLINE_COLLECTOR
- GATE_STAFF
- FOOD_STAFF
- STUDENT

### Main Flow
Admin creates/publishes event → Student registers → Razorpay payment or authorized offline cash registration → Server verifies payment → Ticket generated → HTML ticket emailed → Gate QR scan OR 6-digit manual entry → atomic one-time gate validation → gate validation email → optional food validation → food validation email → dashboards/reports.

### Event Features
- Event name, slug, description, type, logo, banner, venue
- Start/end date-time
- Registration start/end
- Capacity
- Ticket price
- Online/offline payment toggles
- Auto-fill toggle
- Gate validation toggle
- Food validation toggle
- Event status: DRAFT, PUBLISHED, REGISTRATION_CLOSED, LIVE, COMPLETED, CANCELLED, ARCHIVED

### Registration
Required: name, roll number, college, department, email, phone unless auto-filled.
- Mobile-first
- Duplicate prevention
- Deadline/capacity enforcement
- Configurable department dropdown
- Auto-fill through controlled student lookup when enabled
- Never expose unrestricted student directory lookup

### Ticket
Suggested core fields:
```text
id UUID
event_id UUID
registration_id UUID
ticket_code VARCHAR(6)
qr_token_hash / secure token reference
status
gate_validated_at
gate_validated_by
gate_location
food_validated_at
food_validated_by
food_location
created_at
updated_at
```

Ticket code range: `100000–999999`.
QR contains only an opaque secure/signed token, never student PII.

### QR + Manual Gate Validation
Gate UI always provides:
- QR scan
- Manual six-digit code entry

If camera fails:
`[ 5 ][ 8 ][ 3 ][ 2 ][ 1 ][ 4 ] → VERIFY`

The Flask API is authoritative.

### Atomic Gate Validation
Use a transaction-safe update such as:
```sql
UPDATE tickets
SET gate_validated_at = NOW(),
    gate_validated_by = :staff_id,
    gate_location = :gate
WHERE id = :ticket_id
  AND gate_validated_at IS NULL
RETURNING *;
```

Exactly one concurrent request may succeed. The second must receive `ALREADY_USED`.

Record:
- ticket
- staff
- gate
- timestamp
- method QR/MANUAL

### Food Validation
Food is separate from gate:
- gate can be used while food remains unused
- food can be consumed only once
- record counter, staff, time and method
- second attempt returns `FOOD_ALREADY_CLAIMED`

### Payment
Flow:
```text
Student
→ Flask creates Razorpay Order
→ Razorpay Checkout
→ Payment
→ callback + webhook
→ server-side verification
→ idempotent payment update
→ registration PAID
→ ticket generation
→ ticket email
```

Never trust browser-only payment success.
Verify signature and webhook.
Prevent duplicate ticket generation when callback and webhook both arrive.

### Offline Cash
Authorized offline collectors can:
- create registration
- record cash amount
- record student details
- issue ticket
- trigger ticket email
- view their permitted collection history

Every offline transaction records collector, amount, method, timestamp and registration and creates an audit log.

### Email
Use reusable HTML templates:
- registration confirmation
- ticket issued
- payment success/failure
- ticket reissue
- gate validation
- food validation
- cancellation/refund
- event reminder

Ticket email must contain:
- college/event branding
- attendee details
- QR
- large 6-digit fallback code
- clear gate instructions

Gate validation email:
- attendee
- event
- ticket code
- gate
- timestamp
- validation status

Food validation email:
- attendee
- event
- ticket code
- counter
- timestamp
- validation status

Email failure must not undo a successful database transaction.

### Dashboards
Admin:
- registrations
- paid
- failed/pending payments
- offline registrations
- tickets
- gate entries
- food claims
- revenue
- capacity
- reports
- audit logs

Coordinator:
- assigned event metrics only.

Gate:
- successful
- invalid
- already used
- live count

Food:
- claims
- remaining eligible users if configured

### Reports
- Registration
- Payment
- Offline cash
- Tickets
- Gate entries
- Food validation
- Unvalidated tickets
- Invalid/duplicate validation attempts
- Revenue
- CSV export

### Security
- HTTPS
- Supabase Auth/JWT verification
- server-side RBAC
- least privilege
- no service-role key in frontend
- no Razorpay secret in frontend
- secure CORS
- rate limiting
- input validation
- parameterized SQL
- webhook signature verification
- audit logs
- secure headers
- no PII in QR

### API
```text
GET    /api/v1/events
GET    /api/v1/events/{slug}
POST   /api/v1/admin/events
PATCH  /api/v1/admin/events/{id}
POST   /api/v1/events/{id}/register

POST   /api/v1/payments/create-order
POST   /api/v1/payments/verify
POST   /api/v1/webhooks/razorpay

GET    /api/v1/tickets/{id}
POST   /api/v1/tickets/{id}/resend
POST   /api/v1/tickets/{id}/reissue

POST   /api/v1/validation/gate
POST   /api/v1/validation/food

POST   /api/v1/offline/registrations

GET    /api/v1/admin/dashboard
GET    /api/v1/admin/reports/registrations
GET    /api/v1/admin/reports/payments
GET    /api/v1/admin/reports/entries
GET    /api/v1/admin/audit-logs
```

### Suggested Structure
```text
sphoorthy-events/
├── app/
│   ├── api/
│   ├── services/
│   ├── middleware/
│   ├── schemas/
│   ├── utils/
│   ├── config.py
│   └── __init__.py
├── frontend/
├── tests/
├── migrations/
├── requirements.txt
├── vercel.json
├── .env.example
└── README.md
```

### Build Phases
1. Architecture, Supabase schema, Auth, RBAC
2. Event management and registration
3. Razorpay + webhooks + idempotency
4. Ticket generation + QR + HTML email
5. Gate QR/manual validation
6. Food validation + emails
7. Offline collector + reconciliation
8. Dashboards, reports, audit logs
9. Security, testing, performance, Vercel deployment

### Definition of Done
- Real event can be published.
- Student can register.
- Razorpay payment is verified server-side.
- Exactly one ticket is created.
- HTML ticket reaches email.
- QR and six-digit manual validation both work.
- Gate cannot be consumed twice, including concurrent attempts.
- Food cannot be claimed twice.
- Gate/food validation emails are sent.
- Offline cash registration works.
- Dashboards and reports are accurate.
- Critical actions are audited.
- Secrets are never exposed to frontend.
- Automated tests cover critical payment and concurrency flows.

### Antigravity Instructions
Treat this PRD as the V1 source of truth. Do not build a monolithic Flask app. Build database/migrations, Auth/RBAC, APIs, services and tests systematically. Never trust frontend payment or validation flags. Implement payment idempotency and atomic gate/food validation before UI polish. Keep all secrets in environment variables. Provide complete README setup and deployment instructions.
