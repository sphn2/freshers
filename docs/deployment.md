# Production Deployment Guide — Sphoorthy Events

## Target Infrastructure
- **Frontend & Backend API**: Vercel
- **Database & Auth**: Supabase PostgreSQL
- **Payments**: Razorpay
- **Email**: Google Workspace / Gmail SMTP

## Step-by-Step Deployment

### Vercel multi-service project
Import the repository root as one Vercel project (do not set `backend/` or
`frontend/` as the project root). The root `vercel.json` declares:

- `backend`: Flask service rooted at `backend/`, publicly reached through
  `/api/*`.
- `frontend`: Next.js service rooted at `frontend/`, publicly reached through
  all remaining paths.

The browser calls the backend through the same-origin `/api/v1` path; Vercel's
top-level rewrite routes those requests to the backend service. No inter-service
binding is needed because the frontend does not make a server-to-server call to
the backend. Local `npm run dev` continues to use the Next.js rewrite and
`BACKEND_API_URL`; that development proxy is disabled on Vercel.

### Production domains and environment variables
Configure the following variables in Vercel for the **Production** environment,
scoped to the indicated service. Use `https://freshers.rudvay.tech` as the
canonical site URL for links emailed by the backend; the Vercel domain also
serves the site.

**Backend service (`backend`)**

```env
FLASK_ENV=production
FLASK_DEBUG=false
USE_SQLITE=false
APP_URL=https://freshers.rudvay.tech
ALLOWED_ORIGINS=https://freshers.rudvay.tech,https://freshers-nine.vercel.app
```

Also configure the backend's secrets and integrations listed below. Generate
new `SECRET_KEY` and `TICKET_SECRET_KEY` values; do not copy local credentials:
`DATABASE_URL`, `SECRET_KEY`, `TICKET_SECRET_KEY`, `SUPABASE_URL`,
`SUPABASE_JWKS_URL`, `SUPABASE_SECRET_KEY`, Razorpay credentials, and SMTP
credentials.

For `SUPABASE_SECRET_KEY`, use the secret key from the same Supabase project
as `SUPABASE_URL` (new keys start with `sb_secret_`; the legacy `service_role`
JWT is also supported). Never use the frontend publishable/anon key here.

**Frontend service (`frontend`)**

```env
NEXT_PUBLIC_API_URL=/api/v1
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your-supabase-publishable-key>
```

The Supabase URL and publishable key are public client configuration. Never
put a Supabase secret/service-role key, database password, Razorpay secret, or
SMTP password in a `NEXT_PUBLIC_*` variable.

In Supabase Dashboard → Authentication → URL Configuration, set the **Site
URL** to `https://freshers.rudvay.tech`. Add these allowed redirect URLs:

- `https://freshers.rudvay.tech/**`
- `https://freshers-nine.vercel.app/**`
- `http://localhost:3000/**` for local development, if needed

Use Vercel preview URL patterns only if preview deployments need Supabase
authentication; avoid allowing broader patterns than the deployments require.

### 1. Database Setup (Supabase)
1. Create a new Supabase Project.
2. In the Supabase SQL Editor, run `migrations/001_initial_schema.sql`.
3. Run `migrations/002_rls_policies.sql`.
4. Run `migrations/003_security_and_role_hardening.sql` and
   `migrations/004_rls_scope_and_data_api_hardening.sql`.
5. Run `migrations/005_manual_registration_controls.sql` before deploying the
   backend that supports organizer-controlled registration availability.
6. Run `migrations/006_public_registration_and_tiered_pricing.sql` before
   deploying guest registration and year-specific pricing. It adds the
   first-year (default ₹500), second-year (default ₹600), optional other-prefix
   event fees, plus hashed payment/ticket access capabilities.

The nullable `events.registration_open` field is an override: `NULL` respects
the scheduled registration window, `TRUE` opens registrations outside that
window, and `FALSE` closes registrations immediately. Apply migrations to the
intended database through the Supabase SQL Editor or your established
migration workflow; do not deploy the updated backend before this migration is
applied.

### 2. Backend Service Environment
1. The backend is built as the `backend` service by the root Vercel project
   configuration. For non-Vercel hosting, run `gunicorn wsgi:app` from
   `backend/`.
2. Configure the backend's required production environment variables as
   described above. Use separate random secrets per environment and HTTPS-only
   public URLs. Production starts only when required configuration is present.
   Keep `SUPABASE_SECRET_KEY` server-only.

### 3. Frontend Deployment (Vercel)
1. The frontend is built as the `frontend` service by the root Vercel project
   configuration. Configure its production variables as described above.

### 4. Razorpay Webhook Configuration
1. Open Razorpay Dashboard -> Settings -> Webhooks.
2. Add Webhook URL: `https://<your-domain>/api/v1/webhooks/razorpay`.
3. Events to select: `payment.captured` and `payment.failed`.
4. Copy Webhook Secret to `RAZORPAY_WEBHOOK_SECRET`.
