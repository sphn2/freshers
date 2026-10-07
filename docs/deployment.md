# Production Deployment Guide — Sphoorthy Events

## Target Infrastructure
- **Frontend & Backend API**: Vercel
- **Database & Auth**: Supabase PostgreSQL
- **Payments**: Razorpay
- **Email**: Google Workspace / Gmail SMTP

## Step-by-Step Deployment

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

### 2. Backend Deployment (Vercel)
1. Deploy `backend/` to Vercel or run `gunicorn wsgi:app`.
2. Configure production environment variables in Vercel: `FLASK_ENV=production`,
   `USE_SQLITE=false`, `DATABASE_URL`, `SECRET_KEY`, `TICKET_SECRET_KEY`,
   `SUPABASE_URL`, `SUPABASE_JWKS_URL`, `SUPABASE_SECRET_KEY`, `RAZORPAY_KEY_ID`,
   `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `SMTP_USERNAME`,
   `SMTP_PASSWORD`, `APP_URL`, and `ALLOWED_ORIGINS`. Use separate random
   secrets per environment and HTTPS-only public URLs. Production starts only
   when its required configuration is present.
   Keep `SUPABASE_SECRET_KEY` server-only; never add it to a `NEXT_PUBLIC_*`
   variable.

### 3. Frontend Deployment (Vercel)
1. Deploy `frontend/` to Vercel.
2. Set `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Never add Supabase secret/service
   role keys or Razorpay secrets to `NEXT_PUBLIC_*` variables.

### 4. Razorpay Webhook Configuration
1. Open Razorpay Dashboard -> Settings -> Webhooks.
2. Add Webhook URL: `https://<your-backend-domain>/api/v1/webhooks/razorpay`.
3. Events to select: `payment.captured` and `payment.failed`.
4. Copy Webhook Secret to `RAZORPAY_WEBHOOK_SECRET`.
