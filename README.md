# SPHOORTHY EVENTS — Enterprise Event Registration, Ticketing & Validation Platform

SPHOORTHY EVENTS is a production-grade event operations, registration, payment, QR validation, and gate entry platform engineered specifically for Sphoorthy Engineering College.

---

## Technical Stack & Architecture

- **Backend**: Python Flask REST API (`/api/v1/`) with Pydantic v2 validation, Pytest testing suite, and modular service monolith architecture.
- **Frontend**: Next.js 16 App Router + React 19 + TypeScript + Tailwind CSS 4 (mobile-first, single-hand touch optimized handheld operation).
- **Database**: Supabase PostgreSQL with relational foreign keys, `UNIQUE(event_id, ticket_code)` constraints, and RLS policies.
- **Authentication & Authorization**: Supabase Auth JWT verification with role-based access control (`SUPER_ADMIN`, `ADMIN`, `EVENT_MANAGER`, `OFFLINE_COLLECTOR`, `GATE_STAFF`, `FOOD_STAFF`, `STUDENT`).
- **Payments**: Razorpay Orders API with server-side HMAC-SHA256 signature verification, webhook handler, and payment idempotency.
- **Ticketing Engine**: HMAC-SHA256 signed opaque QR tokens + unique 6-digit numeric ticket code generator (`100000–999999`).
- **Gate & Food Validation**: Atomic concurrency-safe validation (`UPDATE ... WHERE gate_validated_at IS NULL RETURNING *`).
- **Email**: Responsive HTML emails sent via Google Workspace / Gmail SMTP.

---

## Project Structure

```text
d:\Freshers Sphn\
├── backend/
│   ├── app/
│   │   ├── api/v1/              # Flask Blueprints (events, registrations, payments, tickets, validation, offline, admin)
│   │   ├── middleware/          # Auth & RBAC Decorators
│   │   ├── schemas/             # Pydantic Schemas
│   │   ├── services/            # Core Business Logic Services
│   │   ├── templates/emails/    # HTML Email Templates
│   │   ├── utils/               # QR Signing & 6-Digit Code Generator
│   │   ├── config.py            # Environment Configuration
│   │   ├── db.py                # Database Manager (PostgreSQL; SQLite for local development/tests)
│   │   └── __init__.py          # App Factory
│   ├── tests/                   # Pytest Test Suite
│   ├── requirements.txt         # Python Dependencies
│   ├── wsgi.py                  # WSGI Entry Point
│   └── vercel.json              # Backend Vercel Deploy Config
├── frontend/
│   ├── app/                     # Next.js App Router Pages (Mobile-First UI)
│   ├── lib/                     # API Client
│   ├── .env.example             # Public frontend configuration template
│   ├── package.json             # Frontend Dependencies
│   └── tailwind.config.js       # Tailwind Styling
├── migrations/                  # PostgreSQL Schema DDL & RLS Policies
├── docs/                        # Architecture, DB, API, Security, & Deployment Docs
├── .env.example                 # Environment Template
└── README.md
```

---

## Local Development Setup

Copy `.env.example` to `.env` in the workspace root and
`frontend/.env.example` to `frontend/.env`. Generate fresh `SECRET_KEY` and
`TICKET_SECRET_KEY` values; demo data is opt-in with `SEED_DEMO_DATA=true`.
Production must use PostgreSQL (`USE_SQLITE=false`) and will refuse SQLite
fallback.

The `.env` files contain local credentials and are ignored by Git. Configure
real secrets in your deployment provider; never commit them or place backend
secrets in `NEXT_PUBLIC_*` variables.

### 1. Backend Setup
```bash
cd backend
python -m venv venv
# On Windows:
.\venv\Scripts\activate

pip install -r requirements.txt
python wsgi.py
# Backend API will start at http://localhost:5000/api/v1
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
# Frontend app will start at http://localhost:3000
```

### Use the app from another device on your Wi-Fi

1. Start the backend with `python wsgi.py`; it listens on the host computer at
   `127.0.0.1:5000`. Start the frontend with `npm run dev`; it listens on all
   local interfaces at port `3000` and proxies `/api/v1` to the backend.
2. On the host computer, run `ipconfig` and find its IPv4 address on the same
   Wi-Fi network. Open `http://<computer-ip>:3000` on the other device. Allow
   inbound port `3000` in Windows Firewall for the private network. The API
   port remains local to the host.
3. Browser camera access on a phone requires a secure HTTPS origin. For camera
   testing, use a trusted HTTPS certificate whose subject includes the
   computer's LAN IP (for example, a locally trusted `mkcert` certificate),
   then run `npm run dev:https -- --experimental-https-key <key-file>
   --experimental-https-cert <certificate-file>`. Trust the issuing
   certificate authority on the phone before opening the HTTPS URL. Manual
   six-digit entry remains available without camera access.

Staff account creation calls the Supabase Auth Admin API from the backend.
Set `SUPABASE_SECRET_KEY` only in the backend environment; never expose it to
the frontend or prefix it with `NEXT_PUBLIC_`.

---

## Running Automated Test Suite

```bash
cd backend
python -m pytest -q
python -m compileall -q app tests
```

Frontend checks:

```bash
cd frontend
npm ci
npm run lint
npm run build
```

Tests cover:
- Health checks, authentication, roles, and event-manager scope
- Public registration, registration windows, duplicate protection, and retries
- Year-based pricing and optional other-prefix fees
- Razorpay order/signature validation and payment idempotency
- Guest payment/ticket capabilities and email behavior
- Gate/food validation, offline registration, and concurrency safety

---

## Deployment Summary

1. **Database**: Apply migrations `001` through `006` in order to the intended
   Supabase/Postgres database. Migrations `005` and `006` are required for
   registration controls, public guest checkout, and tiered pricing.
2. **Backend**: Deploy `backend/` and configure its server-only environment
   variables, including the database, Supabase Auth, Razorpay, SMTP, and
   application secrets.
3. **Frontend**: Deploy `frontend/` with the public Supabase URL/publishable
   key and the appropriate API configuration. Do not expose any server secret.
4. **Payments and email**: Set the Razorpay webhook to
   `https://<backend-domain>/api/v1/webhooks/razorpay` and configure working
   SMTP credentials for checkout and ticket emails.

See [docs/deployment.md](docs/deployment.md), [docs/security.md](docs/security.md),
[docs/api.md](docs/api.md), and [docs/database.md](docs/database.md) for the
complete deployment, security, endpoint, and schema references. Apply database
migrations before deploying backend changes that depend on them.
